import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * Pharmacogenomic drug–gene pairs.
 *
 * Sourced from the CPIC (Clinical Pharmacogenetics Implementation
 * Consortium) public API — the curated registry of drug–gene pairs
 * behind the CPIC guidelines, joined onto our drugs by RxCUI. Each
 * pair carries the CPIC level (A–D), the ClinPGx/PharmGKB clinical
 * annotation level (1A–4), the FDA-label PGx testing annotation when
 * one exists, and a link to the published guideline.
 *
 * This is reference metadata about which gene–drug relationships have
 * curated evidence — never dosing guidance. The disclaimer ships in
 * the response payload so SDK and MCP consumers inherit the framing.
 */

export const PGX_DISCLAIMER =
  "Curated pharmacogenomic drug-gene pairs from CPIC (cpicpgx.org). Levels describe the strength of curated evidence and guideline status, not a recommendation to test or to adjust therapy. Reference metadata only - consult the linked CPIC/ClinPGx guideline and a qualified professional for clinical use.";

export const PgxPairSchema = z.object({
  /** HGNC gene symbol, e.g. CYP2D6, SLCO1B1, HLA-B. */
  gene: z.string().min(1),
  /** CPIC level: A, A/B, B, B/C, C, C/D, D. */
  cpicLevel: z.string().optional(),
  /** ClinPGx (PharmGKB) clinical annotation level: 1A, 1B, 2A, 2B, 3, 4. */
  clinpgxLevel: z.string().optional(),
  /** FDA-label PGx annotation, e.g. "Testing Required", "Actionable PGx". */
  fdaLabelTesting: z.string().optional(),
  guidelineName: z.string().optional(),
  guidelineUrl: z.string().url().optional(),
  /** PMIDs of the published guideline papers for this pair. */
  citations: z.array(z.string()).default([]),
  /** True when CPIC marks the pair's level as provisional. */
  provisional: z.boolean().default(false),
});
export type PgxPair = z.infer<typeof PgxPairSchema>;

export const DrugPgxSchema = z.object({
  drug: SlugSchema,
  pairs: z.array(PgxPairSchema),
  provenance: ProvenanceSchema,
});
export type DrugPgx = z.infer<typeof DrugPgxSchema>;
