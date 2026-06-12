import { z } from "zod";
import { SlugSchema } from "./shared";

/**
 * Conditions are the reverse index of drug indications, grounded on the
 * public-domain ICD-10-CM crosswalk (`lib/ingest/icd10.ts`). A condition
 * is one ICD-10-CM concept — a canonical, librarian-authored label and
 * code — joined to every drug whose labeled indications map to it.
 *
 * Why derived, not ingested:
 *   Indications already live on the drug record, and the ICD-10
 *   crosswalk already runs at ingest, at db:seed, and in the static
 *   fallback. A condition is nothing more than a transposed pivot of
 *   that data, so materialising a separate seed file would only create
 *   a synchronisation hazard. The same move that turned per-drug FAERS
 *   rows into the /reactions directory.
 *
 * Framing: an indication is a *labeled use* recorded on an FDA label,
 * never a treatment recommendation. The directory maps "which drugs are
 * labeled for this condition", and is NOT clinical guidance, a formulary,
 * or a statement that any listed drug is appropriate for any patient.
 */

/** Mandatory framing baked into every condition record + browse page. */
export const CONDITION_DISCLAIMER =
  "Conditions map FDA-labeled indications to ICD-10-CM concepts. Listing a drug under a condition reflects a labeled use only — it is NOT a treatment recommendation, formulary, or clinical guidance.";

export const CONDITION_DIRECTORY_DESCRIPTION =
  "Conditions are ICD-10-CM concepts joined to the drugs whose labeled indications map to them via a conservative public-domain crosswalk. A reference reverse index of labeled uses — never a treatment recommendation.";

/**
 * Lightweight condition record for browse/list surfaces. `category` is
 * the ICD-10-CM chapter the code falls in (e.g. "Diseases of the
 * circulatory system"), derived from the standard chapter ranges.
 */
export const ConditionSummarySchema = z.object({
  slug: SlugSchema,
  /** Canonical condition label from the ICD-10 crosswalk. */
  name: z.string().min(1),
  /** ICD-10-CM code this condition is keyed on (e.g. "I10"). */
  icd10: z.string().min(1),
  /** ICD-10-CM chapter name the code falls in. */
  category: z.string().min(1),
  /** Number of drugs in the dataset labeled for this condition. */
  drugCount: z.number().int().nonnegative(),
});
export type ConditionSummary = z.infer<typeof ConditionSummarySchema>;

/**
 * One drug labeled for a condition, with the verbatim indication
 * text(s) on that drug that mapped to the condition's ICD-10 code — so
 * a reader sees exactly which labeled use produced the link, never an
 * inferred one.
 */
export const ConditionDrugRowSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  /** The drug's indication text(s) that mapped to this condition. */
  indications: z.array(z.string()).min(1),
});
export type ConditionDrugRow = z.infer<typeof ConditionDrugRowSchema>;

/**
 * "Related" conditions: ones most often co-labeled on the same drug set
 * as this one, ranked by Jaccard similarity over the drug-id sets. Pure
 * data-derived graph density — no external ontology required.
 */
export const RelatedConditionSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  /** Drugs labeled for BOTH this condition and the parent condition. */
  sharedDrugs: z.number().int().nonnegative(),
  /** Jaccard = |intersection| / |union| over drug-id sets. */
  similarity: z.number().min(0).max(1),
});
export type RelatedCondition = z.infer<typeof RelatedConditionSchema>;

/**
 * Full condition record. The disclaimer is baked in so SDK consumers
 * receive the framing automatically rather than re-stating it.
 */
export const ConditionSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  icd10: z.string().min(1),
  category: z.string().min(1),
  drugCount: z.number().int().nonnegative(),
  drugs: z.array(ConditionDrugRowSchema),
  relatedConditions: z.array(RelatedConditionSchema),
  disclaimer: z.string(),
});
export type Condition = z.infer<typeof ConditionSchema>;
