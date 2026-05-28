import { z } from "zod";
import { ProvenanceSchema, SeveritySchema, SlugSchema } from "./shared";

/**
 * A directed-but-symmetric interaction between two drugs.
 *
 * The pair is canonicalised so `drugA` < `drugB` lexicographically, which
 * lets us store each pair exactly once and look it up either direction.
 */
export const InteractionSchema = z.object({
  drugA: SlugSchema,
  drugB: SlugSchema,
  severity: SeveritySchema,
  mechanism: z.string().optional(),
  description: z.string(),
  recommendation: z.string().optional(),
  evidenceSpan: z.string().optional(),
  provenance: ProvenanceSchema,
});
export type Interaction = z.infer<typeof InteractionSchema>;

export const InteractionCheckRequestSchema = z.object({
  drugs: z.array(SlugSchema).min(2).max(20),
});
export type InteractionCheckRequest = z.infer<
  typeof InteractionCheckRequestSchema
>;

export const InteractionSummarySchema = z.object({
  contraindicated: z.number().int().nonnegative(),
  major: z.number().int().nonnegative(),
  moderate: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type InteractionSummary = z.infer<typeof InteractionSummarySchema>;

export const InteractionCheckResponseSchema = z.object({
  input: z.array(SlugSchema),
  pairs: z.array(InteractionSchema),
  summary: InteractionSummarySchema,
});
export type InteractionCheckResponse = z.infer<
  typeof InteractionCheckResponseSchema
>;
