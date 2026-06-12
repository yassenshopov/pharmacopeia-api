import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * ClinicalTrials.gov crosswalks.
 *
 * Each drug carries an optional list of registered studies that name
 * the drug as an intervention, sourced from the ClinicalTrials.gov v2
 * API (free, no auth) and refreshed via `npm run ingest:trials`. We
 * keep the most recently updated registrations plus the registry's
 * total match count, so consumers see both a sample and the size of
 * the full space.
 *
 * Registration is NOT evidence: a listed trial says nothing about
 * efficacy, safety, or outcome. The disclaimer ships inside the
 * response payload so SDK and MCP consumers carry the framing forward.
 */

export const TRIALS_DISCLAIMER =
  "Registered studies from ClinicalTrials.gov that list this drug as an intervention. Registration is not evidence of efficacy or safety, and inclusion here is not an endorsement of the study. Reference crosswalk only — consult ClinicalTrials.gov for authoritative, current study records.";

export const TrialEntrySchema = z.object({
  /** ClinicalTrials.gov registry number, the stable canonical id. */
  nctId: z.string().regex(/^NCT\d{8}$/, "NCT id must be NCT + 8 digits"),
  title: z.string().min(1),
  /** Registry status token, e.g. RECRUITING, COMPLETED, UNKNOWN. */
  overallStatus: z.string().min(1),
  /** PHASE1–PHASE4, EARLY_PHASE1, or NA. Empty for observational studies. */
  phases: z.array(z.string()).default([]),
  /** INTERVENTIONAL or OBSERVATIONAL (plus rare registry variants). */
  studyType: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  leadSponsor: z.string().optional(),
  /** Registry start date, YYYY-MM-DD or YYYY-MM. */
  startDate: z.string().optional(),
  /** Date the registration last changed on the registry. */
  lastUpdateDate: z.string().optional(),
  /** Enrollment count as registered (actual or estimated). */
  enrollment: z.number().int().nonnegative().optional(),
  /** Pre-built link to the registry record. */
  url: z.string().url(),
});
export type TrialEntry = z.infer<typeof TrialEntrySchema>;

export const DrugTrialsSchema = z.object({
  drug: SlugSchema,
  /** Total registry matches for the intervention query, not just the sample below. */
  totalCount: z.number().int().nonnegative(),
  trials: z.array(TrialEntrySchema),
  provenance: ProvenanceSchema,
});
export type DrugTrials = z.infer<typeof DrugTrialsSchema>;
