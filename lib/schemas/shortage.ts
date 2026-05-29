import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * FDA drug-shortage status crosswalk.
 *
 * Sourced from the openFDA `drug/drugshortages` endpoint, joined onto
 * the drug record by generic name. Each entry describes one
 * presentation (strength × dosage form) of a drug that is currently
 * listed by the FDA as in shortage, resolved, in discontinuation, or
 * scheduled for discontinuation.
 *
 * This is a frequently-changing public fact — entries can flip status
 * on any business day — so shortage data is refreshed on its own
 * cadence via `npm run ingest:shortages` rather than coupled to the
 * main drug ingest. Provenance is per-entry so the seed file stays a
 * straight mirror of the upstream snapshot.
 *
 * Reference-only, never clinical decision support. Patients and
 * clinicians should consult the live FDA drug shortages database
 * directly: https://www.accessdata.fda.gov/scripts/drugshortages/
 */

export const ShortageStatusSchema = z.enum([
  "active",
  "resolved",
  "discontinuation",
  "to-be-discontinued",
]);
export type ShortageStatus = z.infer<typeof ShortageStatusSchema>;

export const ShortageEntrySchema = z.object({
  /** Slug of the drug this shortage entry belongs to. */
  drug: SlugSchema,
  status: ShortageStatusSchema,
  /** One affected presentation, e.g. "Tablet 500 mg, oral". */
  presentation: z.string().min(1),
  /** Marketing-authorisation holder, when openFDA reports one. */
  sponsor: z.string().optional(),
  /**
   * Verbatim FDA-supplied reason where present ("demand increase",
   * "manufacturing delay", etc.). Always reference text — never
   * paraphrased.
   */
  reason: z.string().optional(),
  /**
   * Optional therapeutic category as supplied by the FDA. Useful for
   * grouping shortages by area on the index page.
   */
  therapeuticCategory: z.string().optional(),
  /** ISO date the FDA last updated this shortage entry. */
  fdaUpdatedAt: z.string().date(),
  provenance: ProvenanceSchema,
});
export type ShortageEntry = z.infer<typeof ShortageEntrySchema>;
