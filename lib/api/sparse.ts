import type { Drug } from "@/lib/schemas";

/**
 * Sparse fieldset (`?fields=…`) support for the drug detail endpoint.
 *
 * Heavy fields on a Drug record — verbatim openFDA label sections,
 * approval history, the full indications list — can easily dominate a
 * payload. Consumers that only need, say, mechanism + interactions can
 * ask for them by name with `?fields=mechanism,interactions` and get
 * back the same Drug shape with the un-requested sections stripped out.
 *
 * Identity fields (slug, name, synonyms, jurisdiction, ingredients,
 * brands, classes, shortDescription, identifiers, provenance) are
 * always present; they're cheap and load-bearing for every consumer.
 * Only the bulky sections are gated by `fields`.
 *
 * The filter is additive and backwards-compatible: omit the query
 * param entirely and the response is the full record exactly as
 * before. Unrecognised section names are silently ignored so callers
 * can be liberal with future-proof names.
 */

/**
 * The set of section names a caller can request. Kept in one place so
 * the docs, the OpenAPI manifest, and the runtime filter never drift.
 */
export const DRUG_SPARSE_SECTIONS = [
  "mechanism",
  "indications",
  "contraindications",
  "dosing",
  "pharmacokinetics",
  "interactions",
  "labelSections",
  "approvalHistory",
  "chemical",
  "patientSummary",
] as const;
export type DrugSparseSection = (typeof DRUG_SPARSE_SECTIONS)[number];

const SECTION_SET: ReadonlySet<string> = new Set(DRUG_SPARSE_SECTIONS);

/**
 * Parse a raw `?fields=a,b,c` query value into a set of recognised
 * section names. Returns `null` when no filter is requested so callers
 * can distinguish "no filter" from "filter with zero sections".
 */
export function parseDrugFields(raw: string | null): Set<DrugSparseSection> | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return new Set();

  const requested = new Set<DrugSparseSection>();
  for (const part of trimmed.split(",")) {
    const name = part.trim();
    if (!name) continue;
    if (SECTION_SET.has(name)) requested.add(name as DrugSparseSection);
  }
  return requested;
}

/**
 * Strip every Drug section the caller did not ask for. Identity fields
 * are always kept; array sections collapse to `[]` and object sections
 * to `undefined` so the response still validates against `DrugSchema`.
 */
export function applyDrugSparseFields(
  drug: Drug,
  fields: Set<DrugSparseSection> | null,
): Drug {
  if (fields === null) return drug;

  const keep = (section: DrugSparseSection): boolean => fields.has(section);

  return {
    slug: drug.slug,
    name: drug.name,
    synonyms: drug.synonyms,
    jurisdiction: drug.jurisdiction,
    ingredients: drug.ingredients,
    brands: drug.brands,
    classes: drug.classes,
    shortDescription: drug.shortDescription,
    identifiers: drug.identifiers,
    provenance: drug.provenance,
    mechanism: keep("mechanism") ? drug.mechanism : undefined,
    indications: keep("indications") ? drug.indications : [],
    contraindications: keep("contraindications") ? drug.contraindications : [],
    dosing: keep("dosing") ? drug.dosing : [],
    pharmacokinetics: keep("pharmacokinetics") ? drug.pharmacokinetics : undefined,
    interactionsNarrative: keep("interactions")
      ? drug.interactionsNarrative
      : undefined,
    labelSections: keep("labelSections") ? drug.labelSections : undefined,
    approvalHistory: keep("approvalHistory") ? drug.approvalHistory : [],
    chemical: keep("chemical") ? drug.chemical : undefined,
    patientSummary: keep("patientSummary") ? drug.patientSummary : undefined,
  };
}
