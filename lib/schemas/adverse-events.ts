import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * Aggregate adverse-event report counts from the openFDA FAERS
 * (FDA Adverse Event Reporting System) endpoint.
 *
 * **These are voluntarily-submitted reports, not incidence rates,
 * not causality, not signals.** A high count does not mean a drug
 * causes a reaction more often than another drug — it reflects how
 * much the drug is prescribed, how heavily it's monitored, and how
 * many reporters chose to submit. We surface coarse, aggregate counts
 * only and refuse to compute denominators, rates, or ratios from
 * them. Every API response and every UI surface ships with this
 * framing inline.
 *
 * Reference statistics only. Patients, clinicians, and researchers
 * should consult openFDA, FAERS Public Dashboard, and primary
 * literature directly for any decision-grade use:
 *   https://open.fda.gov/data/faers/
 *   https://www.fda.gov/drugs/questions-and-answers-fdas-adverse-event-reporting-system-faers/fda-adverse-event-reporting-system-faers-public-dashboard
 */

export const ADVERSE_EVENT_DISCLAIMER =
  "FAERS reports are voluntarily submitted and are NOT incidence rates, signals, or causal evidence. Counts reflect reporting volume, not how often a reaction occurs. Reference statistics only.";

/**
 * A single (reaction → report count) pair as aggregated by
 * `?count=patient.reaction.reactionmeddrapt.exact` on the openFDA
 * `/drug/event` endpoint. `reaction` is the MedDRA preferred term as
 * supplied by the reporter, normalised to title case for display.
 */
export const AdverseEventReportSchema = z.object({
  reaction: z.string().min(1),
  count: z.number().int().nonnegative(),
});
export type AdverseEventReport = z.infer<typeof AdverseEventReportSchema>;

export const AdverseEventStatsSchema = z.object({
  drug: SlugSchema,
  /** Total number of FAERS reports the openFDA query matched. */
  totalReports: z.number().int().nonnegative(),
  /**
   * Top reactions by report count. Capped server-side (typically the
   * top 25) so the payload stays bounded for the long tail of MedDRA
   * preferred terms.
   */
  topReactions: z.array(AdverseEventReportSchema),
  /** ISO date the earliest matched report was received. */
  windowStart: z.string().date().optional(),
  /** ISO date the latest matched report was received. */
  windowEnd: z.string().date().optional(),
  /**
   * Framing string that travels with the data. Hardcoded but emitted
   * inline so any consumer (JSON, SDK, MCP, AI agent) sees the caveat
   * next to the counts.
   */
  disclaimer: z.string(),
  provenance: ProvenanceSchema,
});
export type AdverseEventStats = z.infer<typeof AdverseEventStatsSchema>;
