import {
  CONDITION_DISCLAIMER,
  type Condition,
  type ConditionSummary,
} from "@/lib/schemas";
import { ICD10_CROSSWALK } from "@/lib/ingest/icd10";
import { SEED_DRUGS } from "./seed/drugs";

/**
 * Condition index: a fully-derived view of drug indications, organised
 * as ICD-10-CM concepts.
 *
 * Why derived, not ingested:
 *   Every drug already carries `indications[].icd10`, filled by the
 *   public-domain crosswalk in `lib/ingest/icd10.ts` at ingest, at
 *   db:seed, and once at StaticRepository construction. A condition is a
 *   transposed pivot of that table — materialising a separate seed file
 *   would only create a synchronisation hazard.
 *
 * What's in here:
 *   - Canonical conditions keyed by slug, one per ICD-10-CM code that
 *     the crosswalk knows a human label for.
 *   - Per-condition drug rows, each carrying the verbatim indication
 *     text(s) that produced the link (never an inferred one).
 *   - Related conditions ranked by Jaccard similarity over the set of
 *     drugs labeled for each condition.
 *
 * The build is deterministic (sorted output, no clocks), so re-runs
 * against the same drug set produce identical structures. Both backends
 * feed their own drug snapshot through the same builder, so they can
 * never disagree about a condition's slug, members, or ordering.
 */

const RELATED_TOP_N = 10;
const RELATED_MIN_SHARED_DRUGS = 2;

/** Slugify a condition label to `lower-kebab` form. */
function slugifyConditionName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Map an ICD-10-CM code to its chapter name. These are the standard
 * public-domain ICD-10-CM chapter ranges (CDC/NCHS) — a fixed structure
 * of the classification, not an authored interpretation.
 */
export function icd10Chapter(code: string): string {
  const letter = code.charAt(0).toUpperCase();
  const num = Number.parseInt(code.slice(1, 3), 10);
  switch (letter) {
    case "A":
    case "B":
      return "Certain infectious and parasitic diseases";
    case "C":
      return "Neoplasms";
    case "D":
      return num <= 49 ? "Neoplasms" : "Diseases of the blood and immune mechanism";
    case "E":
      return "Endocrine, nutritional and metabolic diseases";
    case "F":
      return "Mental, behavioral and neurodevelopmental disorders";
    case "G":
      return "Diseases of the nervous system";
    case "H":
      return num <= 59
        ? "Diseases of the eye and adnexa"
        : "Diseases of the ear and mastoid process";
    case "I":
      return "Diseases of the circulatory system";
    case "J":
      return "Diseases of the respiratory system";
    case "K":
      return "Diseases of the digestive system";
    case "L":
      return "Diseases of the skin and subcutaneous tissue";
    case "M":
      return "Diseases of the musculoskeletal system and connective tissue";
    case "N":
      return "Diseases of the genitourinary system";
    case "O":
      return "Pregnancy, childbirth and the puerperium";
    case "P":
      return "Certain conditions originating in the perinatal period";
    case "Q":
      return "Congenital malformations and chromosomal abnormalities";
    case "R":
      return "Symptoms, signs and abnormal clinical findings";
    case "S":
    case "T":
      return "Injury, poisoning and external causes";
    case "Z":
      return "Factors influencing health status and contact with health services";
    default:
      return "Other";
  }
}

export interface ConditionDef {
  code: string;
  label: string;
  slug: string;
  category: string;
}

/**
 * Canonical condition definitions, one per ICD-10-CM code the crosswalk
 * knows a label for. Built once from the crosswalk table. When two
 * crosswalk entries map a label to the same code, the first label wins;
 * when two labels slugify to the same value, the later one is
 * disambiguated with its code so slugs stay unique and stable.
 */
function buildConditionDefs(): Map<string, ConditionDef> {
  const byCode = new Map<string, ConditionDef>();
  const usedSlugs = new Set<string>();
  for (const entry of ICD10_CROSSWALK) {
    for (const code of entry.codes) {
      if (byCode.has(code)) continue;
      let slug = slugifyConditionName(entry.label);
      if (!slug) continue;
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${slugifyConditionName(code)}`;
      }
      usedSlugs.add(slug);
      byCode.set(code, {
        code,
        label: entry.label,
        slug,
        category: icd10Chapter(code),
      });
    }
  }
  return byCode;
}

const CONDITION_DEFS = buildConditionDefs();

interface BuiltCondition {
  def: ConditionDef;
  /** drugSlug → row. */
  drugRows: Map<
    string,
    { slug: string; name: string; indications: Set<string> }
  >;
  /** Set of drug slugs labeled for this condition. Used for Jaccard. */
  drugSet: Set<string>;
}

export interface ConditionIndex {
  /** Canonical conditions keyed by slug. */
  conditions: Map<string, Condition>;
  /** Summaries in browse order (drugCount desc, then name). */
  summaries: ConditionSummary[];
}

/** A minimal drug shape the builder needs — name plus indication codes. */
export interface ConditionIndexDrug {
  slug: string;
  name: string;
  indications: { text: string; icd10: string[] }[];
}

export interface ConditionIndexInputs {
  drugs: ConditionIndexDrug[];
}

export function buildConditionIndex(
  inputs: ConditionIndexInputs,
): ConditionIndex {
  const codeToSlug = new Map<string, string>();
  for (const def of CONDITION_DEFS.values()) codeToSlug.set(def.code, def.slug);

  // Phase 1: accumulate per-condition drug rows from indication codes.
  const built = new Map<string, BuiltCondition>();
  for (const drug of inputs.drugs) {
    for (const ind of drug.indications) {
      const text = ind.text.trim();
      if (!text) continue;
      for (const code of ind.icd10) {
        const def = CONDITION_DEFS.get(code);
        if (!def) continue;
        let entry = built.get(def.slug);
        if (!entry) {
          entry = { def, drugRows: new Map(), drugSet: new Set() };
          built.set(def.slug, entry);
        }
        const row = entry.drugRows.get(drug.slug);
        if (row) {
          row.indications.add(text);
        } else {
          entry.drugRows.set(drug.slug, {
            slug: drug.slug,
            name: drug.name,
            indications: new Set([text]),
          });
        }
        entry.drugSet.add(drug.slug);
      }
    }
  }

  // Phase 2: related conditions via Jaccard over drug sets, streamed by
  // co-occurrence rather than naive O(C²) pair iteration.
  const cooccurrence = new Map<string, Map<string, number>>();
  const drugConditionLists = new Map<string, string[]>();
  for (const [slug, entry] of built) {
    for (const drugSlug of entry.drugSet) {
      const list = drugConditionLists.get(drugSlug) ?? [];
      list.push(slug);
      drugConditionLists.set(drugSlug, list);
    }
  }
  for (const list of drugConditionLists.values()) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      let aRow = cooccurrence.get(a);
      if (!aRow) {
        aRow = new Map();
        cooccurrence.set(a, aRow);
      }
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        aRow.set(b, (aRow.get(b) ?? 0) + 1);
      }
    }
  }

  // Phase 3: materialise public Condition objects.
  const conditions = new Map<string, Condition>();
  for (const [slug, entry] of built) {
    const drugRows = [...entry.drugRows.values()]
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        indications: [...r.indications].sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const myDrugCount = entry.drugSet.size;
    const coRow = cooccurrence.get(slug) ?? new Map();
    const related = [...coRow.entries()]
      .filter(([, shared]) => shared >= RELATED_MIN_SHARED_DRUGS)
      .map(([otherSlug, shared]) => {
        const other = built.get(otherSlug);
        if (!other) return null;
        const union = myDrugCount + other.drugSet.size - shared;
        const similarity = union > 0 ? shared / union : 0;
        return {
          slug: otherSlug,
          name: other.def.label,
          sharedDrugs: shared,
          similarity,
        };
      })
      .filter(
        (r): r is NonNullable<typeof r> => r !== null && r.similarity > 0,
      )
      .sort((a, b) => {
        if (b.similarity !== a.similarity) return b.similarity - a.similarity;
        if (b.sharedDrugs !== a.sharedDrugs)
          return b.sharedDrugs - a.sharedDrugs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, RELATED_TOP_N);

    conditions.set(slug, {
      slug,
      name: entry.def.label,
      icd10: entry.def.code,
      category: entry.def.category,
      drugCount: myDrugCount,
      drugs: drugRows,
      relatedConditions: related,
      disclaimer: CONDITION_DISCLAIMER,
    });
  }

  // Browse order: most-labeled conditions first, ties broken by name.
  const summaries: ConditionSummary[] = [...conditions.values()]
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      icd10: c.icd10,
      category: c.category,
      drugCount: c.drugCount,
    }))
    .sort((a, b) => {
      if (b.drugCount !== a.drugCount) return b.drugCount - a.drugCount;
      return a.name.localeCompare(b.name);
    });

  return { conditions, summaries };
}

/** Canonical lowercase haystack for `?q=` filtering of conditions. */
export function conditionSearchText(c: ConditionSummary): string {
  return [c.name, c.slug, c.icd10, c.category].join(" ").toLowerCase();
}

let _cached: ConditionIndex | null = null;

/** Seed-backed index, built lazily once per process. */
export function getConditionIndex(): ConditionIndex {
  if (!_cached) {
    _cached = buildConditionIndex({
      drugs: SEED_DRUGS.map((d) => ({
        slug: d.slug,
        name: d.name,
        indications: d.indications.map((i) => ({
          text: i.text,
          icd10: i.icd10,
        })),
      })),
    });
  }
  return _cached;
}
