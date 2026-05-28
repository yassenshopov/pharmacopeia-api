/**
 * scripts/ingest/fetch-drugs.ts
 *
 * Stage-0 ingest. Builds the static seed dataset from two free,
 * no-auth-required public sources:
 *
 *  1. RxNav (NIH)   https://rxnav.nlm.nih.gov/REST/
 *     Authoritative IDs, brand names, ingredients, ATC + EPC + MOA classes.
 *  2. openFDA       https://api.fda.gov/drug/label.json
 *     FDA-labeled narrative text for mechanism, indications,
 *     contraindications, and pharmacokinetics.
 *
 * The script is idempotent: deterministic timestamps, sorted output,
 * stable hashing. Re-running it produces byte-identical files unless
 * an upstream source changed.
 *
 * Run:   npm run ingest
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrugClassSchema,
  DrugSchema,
  IngredientSchema,
  type Drug,
  type DrugClass,
  type DrugClassKind,
  type DrugClassRef,
  type Ingredient,
  type Provenance,
} from "../../lib/schemas";

// ────────────────────────────────────────────────────────────────────────
// Paths and constants
// ────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(REPO_ROOT, "lib/data/seed");

// Deterministic fixed timestamp so re-runs do not diff just because of clock.
const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

// Curated list of widely-prescribed drugs in the US. Targets ~50 valid records;
// a handful may be dropped if upstream coverage is poor.
const DRUG_NAMES: ReadonlyArray<string> = [
  // existing seed set
  "metformin",
  "lisinopril",
  "atorvastatin",
  "levothyroxine",
  "amlodipine",
  "omeprazole",
  "sertraline",
  "gabapentin",
  "hydrochlorothiazide",
  "ibuprofen",
  // expansion
  "albuterol",
  "losartan",
  "simvastatin",
  "acetaminophen",
  "prednisone",
  "amoxicillin",
  "azithromycin",
  "ciprofloxacin",
  "fluoxetine",
  "escitalopram",
  "alprazolam",
  "lorazepam",
  "citalopram",
  "trazodone",
  "montelukast",
  "fluticasone",
  "tramadol",
  "oxycodone",
  "furosemide",
  "metoprolol",
  "carvedilol",
  "warfarin",
  "clopidogrel",
  "aspirin",
  "pantoprazole",
  "esomeprazole",
  "famotidine",
  "loratadine",
  "cetirizine",
  "diphenhydramine",
  "ondansetron",
  "methylprednisolone",
  "dexamethasone",
  "glimepiride",
  "pioglitazone",
  "rosuvastatin",
  "pravastatin",
  "ezetimibe",
  "valsartan",
  "finasteride",
  "tamsulosin",
  "sildenafil",
  "tadalafil",
  "latanoprost",
];

// ────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Strip leading section headers ("12.1 MECHANISM OF ACTION", "1 INDICATIONS
 * AND USAGE", etc.) and collapse whitespace. openFDA labels often prefix the
 * narrative with these markers.
 */
function cleanLabelText(text: string): string {
  return text
    .replace(/^\s*\d+(\.\d+)*\s+/i, "")
    .replace(
      /^\s*(MECHANISM OF ACTION|INDICATIONS AND USAGE|INDICATIONS|CONTRAINDICATIONS?|PHARMACOKINETICS|CLINICAL PHARMACOLOGY)[:\s]+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the first 1-2 sentences of `text`, never exceeding `maxLen`. Used to
 * derive a brief `summary` from openFDA's frequently-verbose narrative blocks.
 */
function firstSentences(text: string, maxLen = 1500): string {
  const cleaned = cleanLabelText(text);
  if (!cleaned) return cleaned;

  const sentenceRe = /[.!?](\s+|$)/g;
  let count = 0;
  let endIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(cleaned)) !== null) {
    count++;
    endIdx = m.index + 1;
    if (count >= 2) break;
  }
  if (endIdx > 0 && endIdx <= maxLen) return cleaned.slice(0, endIdx).trim();
  if (cleaned.length <= maxLen) return cleaned;
  // Hard cap fallback.
  const hardCut = cleaned.slice(0, maxLen);
  const lastPeriod = hardCut.lastIndexOf(". ");
  return (lastPeriod > 200 ? hardCut.slice(0, lastPeriod + 1) : hardCut + "…").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "pharmacopeia-ingest/1.0 (+local dev)" },
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error(`fetch failed: ${url}`);
}

function makeProv(
  sourceUrl: string,
  responseForHash: unknown,
  extractor: Provenance["extractor"],
  confidence: number,
): Provenance {
  const hashBasis =
    typeof responseForHash === "string"
      ? responseForHash
      : JSON.stringify(responseForHash ?? sourceUrl);
  return {
    sourceUrl,
    sourceHash: sha256(hashBasis).slice(0, 64),
    extractedAt: EXTRACTED_AT,
    extractor,
    confidence,
  };
}

// ────────────────────────────────────────────────────────────────────────
// RxNav lookups
// ────────────────────────────────────────────────────────────────────────

interface RxNavSummary {
  rxcui: string;
  name: string;
  synonyms: string[];
  brands: string[];
  classRefs: DrugClassRef[];
  classRecords: DrugClass[];
  atcCodes: string[];
}

async function fetchRxNavSummary(name: string): Promise<RxNavSummary | null> {
  const idUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=2`;
  const idResp = await fetchJson(idUrl);
  const rxcui: string | undefined = idResp?.idGroup?.rxnormId?.[0];
  if (!rxcui) return null;

  const propsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
  const propsResp = await fetchJson(propsUrl);
  const props = propsResp?.properties;
  if (!props) return null;
  const canonicalName = titleCase(props.name ?? name);
  const synonyms = props.synonym ? [props.synonym] : [];

  // brand names containing this ingredient
  const brandsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN`;
  const brandsResp = await fetchJson(brandsUrl);
  const brandGroups = brandsResp?.relatedGroup?.conceptGroup ?? [];
  const brandSet = new Set<string>();
  for (const g of brandGroups) {
    if (g.tty !== "BN") continue;
    for (const c of g.conceptProperties ?? []) {
      if (c?.name) brandSet.add(c.name);
    }
  }
  const brands = Array.from(brandSet).sort();

  // classes
  const classUrl = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${rxcui}`;
  const classResp = await fetchJson(classUrl);
  const classList = classResp?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];

  const classRefs: DrugClassRef[] = [];
  const classRecords: DrugClass[] = [];
  const seenRefs = new Set<string>();

  for (const item of classList) {
    const min = item?.minConcept;
    // only look at the ingredient (IN) row to avoid combination-product noise
    if (!min || (min.tty !== "IN" && min.tty !== "PIN")) continue;
    if (min.rxcui !== rxcui) continue;

    const concept = item?.rxclassMinConceptItem;
    if (!concept?.classId || !concept?.className) continue;

    const classType: string = concept.classType ?? "";
    const kind = mapClassType(classType);
    if (!kind) continue;

    const slug = slugify(concept.className);
    if (!slug) continue;

    const key = `${kind}:${slug}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);

    classRefs.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
    });

    const classProv = makeProv(
      `https://rxnav.nlm.nih.gov/REST/rxclass/class/byId.json?classId=${concept.classId}`,
      { classId: concept.classId, className: concept.className, kind },
      "rxclass",
      0.95,
    );

    classRecords.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
      parent: null,
      drugCount: 0,
      provenance: classProv,
    });
  }

  classRefs.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  classRecords.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));

  const atcCodes = Array.from(
    new Set(
      classRefs
        .filter((c) => c.kind === "atc" && c.code)
        .map((c) => c.code as string),
    ),
  ).sort();

  return {
    rxcui,
    name: canonicalName,
    synonyms,
    brands,
    classRefs,
    classRecords,
    atcCodes,
  };
}

function mapClassType(classType: string): DrugClassKind | null {
  switch (classType) {
    case "ATC1-4":
    case "ATC":
      return "atc";
    case "EPC":
      return "epc";
    case "MOA":
      return "moa";
    case "PE":
      return "pe";
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// openFDA label lookup
// ────────────────────────────────────────────────────────────────────────

interface OpenFdaLabel {
  url: string;
  raw: any;
}

async function fetchOpenFdaLabel(name: string): Promise<OpenFdaLabel | null> {
  // Fetch up to 50 candidate labels and pick the first one whose generic_name
  // is mono-substance. Combination products (e.g. "SITAGLIPTIN AND METFORMIN
  // HYDROCHLORIDE") are rejected so we get the FDA label for the single drug.
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/label.json?search=${search}&limit=50`;
  const resp = await fetchJson(url);
  const results: any[] = resp?.results ?? [];
  if (!results.length) return null;

  const upper = name.toUpperCase();
  const SALT_SUFFIXES = [
    "HYDROCHLORIDE",
    "HCL",
    "SODIUM",
    "POTASSIUM",
    "CALCIUM",
    "SULFATE",
    "SUCCINATE",
    "TARTRATE",
    "MALEATE",
    "FUMARATE",
    "CITRATE",
    "PHOSPHATE",
    "BESYLATE",
    "MESYLATE",
    "ACETATE",
    "BROMIDE",
    "CHLORIDE",
    "BITARTRATE",
  ];

  function isMonoMatch(gnList: string[]): boolean {
    if (gnList.length !== 1) return false;
    const single = (gnList[0] ?? "").toUpperCase().trim();
    if (!single) return false;
    // reject anything that smells like a combination product
    if (/\bAND\b|\bWITH\b|[,/;+]/.test(single)) return false;
    if (single === upper) return true;
    // allow "<NAME> HYDROCHLORIDE", "<NAME> SODIUM" etc.
    const tokens = single.split(/\s+/);
    if (tokens.length === 1 && tokens[0] === upper) return true;
    if (tokens.length === 2 && tokens[0] === upper && SALT_SUFFIXES.includes(tokens[1]))
      return true;
    // some ingredients are themselves multi-word (e.g. "FLUTICASONE PROPIONATE")
    if (tokens[0] === upper && tokens.slice(1).every((t) => SALT_SUFFIXES.includes(t)))
      return true;
    return false;
  }

  const monoMatch = results.find((r) =>
    isMonoMatch(r?.openfda?.generic_name ?? []),
  );

  if (!monoMatch) {
    // fall back to the first result whose generic_name contains the search term
    const loose = results.find((r) => {
      const gn: string[] = r?.openfda?.generic_name ?? [];
      return gn.some((g) => (g ?? "").toUpperCase().includes(upper));
    });
    if (!loose) return null;
    return { url, raw: loose };
  }
  return { url, raw: monoMatch };
}

// ────────────────────────────────────────────────────────────────────────
// Per-drug ingest
// ────────────────────────────────────────────────────────────────────────

interface IngestOk {
  ok: true;
  drug: Drug;
  ingredient: Ingredient;
  classes: DrugClass[];
  coverage: CoverageBits;
}
interface IngestFail {
  ok: false;
  reason: string;
}
type IngestResult = IngestOk | IngestFail;

interface CoverageBits {
  mechanism: boolean;
  indications: boolean;
  contraindications: boolean;
  pharmacokinetics: boolean;
  atc: boolean;
  brands: boolean;
  label: boolean;
}

async function ingestOne(name: string, idx: number, total: number): Promise<IngestResult> {
  const slug = slugify(name);
  const tag = `[${idx + 1}/${total}] ${slug}`;
  process.stderr.write(`${tag}: resolving RxCUI...\n`);

  const rx = await fetchRxNavSummary(name);
  if (!rx) {
    process.stderr.write(`${tag}: ✗ no RxNav result, skipping\n`);
    return { ok: false, reason: "no-rxcui" };
  }

  const label = await fetchOpenFdaLabel(name).catch((e) => {
    process.stderr.write(`${tag}: ! openFDA error (${(e as Error).message}); continuing without label\n`);
    return null;
  });

  // narrative fields
  const mechRaw: string | undefined = label?.raw?.mechanism_of_action?.[0];
  const indRaw: string | undefined = label?.raw?.indications_and_usage?.[0];
  const ciRaw: string | undefined = label?.raw?.contraindications?.[0];
  const pkRaw: string | undefined = label?.raw?.pharmacokinetics?.[0];

  const mechanism = mechRaw ? { summary: firstSentences(mechRaw, 1500), targets: [] } : undefined;
  const indications = indRaw
    ? [{ text: firstSentences(indRaw, 1200), icd10: [] as string[] }]
    : [];
  const contraindications = ciRaw
    ? [{ text: firstSentences(ciRaw, 1200), severity: "contraindicated" as const }]
    : [];
  const pharmacokinetics = pkRaw ? { metabolism: firstSentences(pkRaw, 600) } : undefined;

  // ingredient (1:1 with drug for v0)
  const ingredientProv = makeProv(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
    { rxcui: rx.rxcui, name: rx.name },
    "rxnorm",
    0.95,
  );
  const ingredient: Ingredient = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    rxcui: rx.rxcui,
    drugCount: 1,
    provenance: ingredientProv,
  };

  // drug provenance: openFDA when label found, else RxNav
  const drugProv: Provenance = label
    ? {
        sourceUrl: label.url,
        sourceHash: sha256(JSON.stringify(label.raw)).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "openfda",
        confidence: 0.85,
      }
    : {
        sourceUrl: `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
        sourceHash: sha256(`rxnav:${rx.rxcui}:${rx.name}`).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "rxnorm",
        confidence: 0.95,
      };

  const drug: Drug = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    jurisdiction: "US-FDA",
    ingredients: [{ slug, name: rx.name }],
    brands: rx.brands.slice(0, 12),
    classes: rx.classRefs,
    mechanism,
    indications,
    contraindications,
    dosing: [],
    pharmacokinetics,
    approvalHistory: [],
    identifiers: {
      rxcui: rx.rxcui,
      ndc: [],
      atc: rx.atcCodes,
    },
    provenance: drugProv,
  };

  try {
    DrugSchema.parse(drug);
    IngredientSchema.parse(ingredient);
    rx.classRecords.forEach((c) => DrugClassSchema.parse(c));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${tag}: ✗ schema validation failed: ${msg}\n`);
    return { ok: false, reason: "schema-fail" };
  }

  const coverage: CoverageBits = {
    mechanism: !!mechanism,
    indications: indications.length > 0,
    contraindications: contraindications.length > 0,
    pharmacokinetics: !!pharmacokinetics,
    atc: rx.atcCodes.length > 0,
    brands: rx.brands.length > 0,
    label: !!label,
  };

  const badges = [
    `rxcui=${rx.rxcui}`,
    `brands=${rx.brands.length}`,
    `classes=${rx.classRefs.length}`,
    label ? "label=yes" : "label=no",
    mechanism ? "mech=yes" : "mech=no",
  ].join(" ");
  process.stderr.write(`${tag}: ✓ ${badges}\n`);

  return { ok: true, drug, ingredient, classes: rx.classRecords, coverage };
}

// ────────────────────────────────────────────────────────────────────────
// Emit pretty TypeScript files
// ────────────────────────────────────────────────────────────────────────

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function emitTs(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad1 + emitTs(v, indent + 1));
    return "[\n" + items.join(",\n") + ",\n" + pad + "]";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => {
      const key = SAFE_KEY.test(k) ? k : JSON.stringify(k);
      return pad1 + key + ": " + emitTs(v, indent + 1);
    });
    return "{\n" + lines.join(",\n") + ",\n" + pad + "}";
  }
  throw new Error(`emitTs: unsupported value ${typeof value}`);
}

const HEADER_DRUGS = `import type { Drug } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts.
 *
 * Stage-0 drug records ingested from RxNav (RxCUI / brands / classes /
 * ATC codes) and openFDA drug label API (mechanism, indications,
 * contraindications, pharmacokinetics narrative).
 *
 * Edits to this file will be overwritten on the next \`npm run ingest\`.
 * To curate a record by hand, drop it from the ingest list and move it
 * to a separate manually-edited seed file.
 *
 * Provenance:
 *   - openfda  : drug-level narrative fields (confidence 0.85)
 *   - rxnorm   : ingredients (confidence 0.95)
 *   - rxclass  : class memberships (confidence 0.95)
 *
 * IMPORTANT: This data is for development and illustrative use only.
 * It is not a clinical reference and must not be used to make medication
 * decisions.
 */
`;

const HEADER_CLASSES = `import type { DrugClass } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts. Derived from the
 * class memberships of every ingested drug (ATC, EPC, MOA, PE) via
 * RxNav RxClass.
 */
`;

const HEADER_INGREDIENTS = `import type { Ingredient } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts. One ingredient per
 * ingested drug (mono-substance v0). RxCUIs and canonical names come
 * from RxNav properties.
 */
`;

function writeFile(filename: string, body: string): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, body, "utf8");
  process.stderr.write(`wrote ${path}\n`);
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // PHARM_LIMIT lets dev runs target a small subset for fast iteration.
  const limit = Number.parseInt(process.env.PHARM_LIMIT ?? "", 10);
  const names = Number.isFinite(limit) && limit > 0
    ? DRUG_NAMES.slice(0, limit)
    : DRUG_NAMES;
  process.stderr.write(
    `Ingesting ${names.length} drugs from RxNav + openFDA...\n\n`,
  );

  const drugs: Drug[] = [];
  const ingredients: Ingredient[] = [];
  const classMap = new Map<string, DrugClass>(); // key = `${kind}:${slug}`
  const coverage = {
    mechanism: 0,
    indications: 0,
    contraindications: 0,
    pharmacokinetics: 0,
    atc: 0,
    brands: 0,
    label: 0,
  };
  const skipped: { name: string; reason: string }[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const res = await ingestOne(name, i, names.length);
      if (!res.ok) {
        skipped.push({ name, reason: res.reason });
      } else {
        drugs.push(res.drug);
        ingredients.push(res.ingredient);
        for (const c of res.classes) {
          const key = `${c.kind}:${c.slug}`;
          const existing = classMap.get(key);
          if (existing) {
            existing.drugCount += 1;
          } else {
            classMap.set(key, { ...c, drugCount: 1 });
          }
        }
        for (const k of Object.keys(coverage) as (keyof CoverageBits)[]) {
          if (res.coverage[k]) coverage[k] += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[${i + 1}/${names.length}] ${name}: ✗ error: ${msg}\n`);
      skipped.push({ name, reason: `error: ${msg}` });
    }
    // Be polite to upstream APIs.
    await sleep(150);
  }

  // Slug collision fix: when the same slugified name appears under multiple
  // class kinds (e.g. "proton-pump-inhibitors" as both ATC and MOA), make every
  // colliding entry's slug kind-qualified so the by-slug map and the UI keys
  // stay unique. Slugs of non-colliding classes are left untouched.
  const slugGroups = new Map<string, DrugClass[]>();
  for (const c of classMap.values()) {
    const list = slugGroups.get(c.slug) ?? [];
    list.push(c);
    slugGroups.set(c.slug, list);
  }
  const slugRewrites = new Map<string, string>(); // `${kind}:${oldSlug}` -> newSlug
  for (const [slug, group] of slugGroups) {
    if (group.length <= 1) continue;
    for (const c of group) {
      const newSlug = `${slug}-${c.kind}`;
      slugRewrites.set(`${c.kind}:${slug}`, newSlug);
      c.slug = newSlug;
    }
  }
  // Propagate slug rewrites into drug.classes
  for (const d of drugs) {
    d.classes = d.classes.map((ref) => {
      const newSlug = slugRewrites.get(`${ref.kind}:${ref.slug}`);
      return newSlug ? { ...ref, slug: newSlug } : ref;
    });
  }

  // Deterministic order
  drugs.sort((a, b) => a.slug.localeCompare(b.slug));
  for (const d of drugs) {
    d.classes.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  }
  ingredients.sort((a, b) => a.slug.localeCompare(b.slug));
  const classes = Array.from(classMap.values()).sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug),
  );

  // Re-validate after rewrites to make sure we did not break anything.
  for (const d of drugs) DrugSchema.parse(d);
  for (const c of classes) DrugClassSchema.parse(c);

  // Emit files
  const drugsBody = `${HEADER_DRUGS}
export const SEED_DRUGS: Drug[] = ${emitTs(drugs)};

export const SEED_DRUGS_BY_SLUG: Record<string, Drug> = Object.fromEntries(
  SEED_DRUGS.map((d) => [d.slug, d]),
);
`;

  const classesBody = `${HEADER_CLASSES}
export const SEED_CLASSES: DrugClass[] = ${emitTs(classes)};

export const SEED_CLASSES_BY_SLUG: Record<string, DrugClass> = Object.fromEntries(
  SEED_CLASSES.map((c) => [c.slug, c]),
);
`;

  const ingredientsBody = `${HEADER_INGREDIENTS}
export const SEED_INGREDIENTS: Ingredient[] = ${emitTs(ingredients)};

export const SEED_INGREDIENTS_BY_SLUG: Record<string, Ingredient> =
  Object.fromEntries(SEED_INGREDIENTS.map((i) => [i.slug, i]));
`;

  if (process.env.PHARM_DRY_RUN === "1") {
    process.stderr.write(
      `DRY_RUN: validated ${drugs.length} drugs / ${ingredients.length} ingredients / ${classes.length} classes; not writing files.\n`,
    );
  } else {
    writeFile("drugs.ts", drugsBody);
    writeFile("classes.ts", classesBody);
    writeFile("ingredients.ts", ingredientsBody);
  }

  // Final summary
  const total = names.length;
  process.stderr.write(`\n──────── ingest summary ────────\n`);
  process.stderr.write(`drugs:        ${drugs.length}/${total}\n`);
  process.stderr.write(`ingredients:  ${ingredients.length}\n`);
  process.stderr.write(`classes:      ${classes.length}\n`);
  process.stderr.write(`\ncoverage (out of ${drugs.length} successful drugs):\n`);
  process.stderr.write(`  mechanism:          ${coverage.mechanism}/${drugs.length}\n`);
  process.stderr.write(`  indications:        ${coverage.indications}/${drugs.length}\n`);
  process.stderr.write(`  contraindications:  ${coverage.contraindications}/${drugs.length}\n`);
  process.stderr.write(`  pharmacokinetics:   ${coverage.pharmacokinetics}/${drugs.length}\n`);
  process.stderr.write(`  ATC code:           ${coverage.atc}/${drugs.length}\n`);
  process.stderr.write(`  brand names:        ${coverage.brands}/${drugs.length}\n`);
  process.stderr.write(`  openFDA label:      ${coverage.label}/${drugs.length}\n`);
  if (skipped.length) {
    process.stderr.write(`\nskipped (${skipped.length}):\n`);
    for (const s of skipped) {
      process.stderr.write(`  - ${s.name}: ${s.reason}\n`);
    }
  }
  process.stderr.write(`\nDone.\n`);
}

main().catch((e) => {
  process.stderr.write(`\nFATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
