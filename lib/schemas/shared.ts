import { z } from "zod";

/**
 * Shared primitives used across every entity in pharmacopeia-api.
 *
 * Provenance is attached to every extracted record so that:
 *  - we can selectively refresh only the fields whose source changed
 *  - public consumers can audit any claim back to a canonical source
 *  - confidence is exposed so clients can gate on it
 */

export const JurisdictionSchema = z.enum([
  "US-FDA",
  "EU-EMA",
  "UK-MHRA",
  "CA-HC",
]);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const SeveritySchema = z.enum([
  "contraindicated",
  "major",
  "moderate",
  "minor",
  "unknown",
]);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * `extractor` records which pipeline produced a record. We keep the
 * surface intentionally permissive (any lowercase kebab-cased token,
 * optionally with an `@version` suffix) so new sources and model
 * families — `claude-opus-4.7`, `ingest-script@v1`, `atc-who`,
 * `hand-curated` — can land without a schema migration. The shape is
 * still validated; runtime classification (ai vs. sourced vs. curated)
 * lives in `lib/provenance/kind.ts`.
 */
export const ExtractorSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z][a-z0-9-]*(@[a-z0-9.-]+)?$/,
    "extractor must be lowercase-kebab, optionally suffixed with @version",
  );
export type Extractor = z.infer<typeof ExtractorSchema>;

export const ProvenanceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceHash: z.string().min(1),
  extractedAt: z.string().datetime(),
  extractor: ExtractorSchema,
  confidence: z.number().min(0).max(1),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Slugs are lowercase a-z, 0-9, and hyphens");

export const PaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "not_found",
      "invalid_request",
      "unauthorized",
      "forbidden",
      "rate_limited",
      "not_configured",
      "internal_error",
    ]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
