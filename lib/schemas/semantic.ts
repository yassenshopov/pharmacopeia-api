import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * Semantic retrieval surface: passages, semantic search, and the
 * grounded (paid) retrieval tier.
 *
 * A *passage* is the retrieval unit — one chunk of one section of one
 * drug record, extracted by `lib/data/passages.ts`. Passages are
 * embedded offline (pgvector on Supabase) and queried by cosine
 * similarity; when no embeddings provider is configured the same
 * passages are scored lexically so the response contract never
 * changes shape.
 */

/** Baked into every semantic / grounded response envelope. */
export const SEMANTIC_DISCLAIMER =
  "Educational and informational reference only — not medical advice, diagnosis, or treatment guidance. Verify every passage against its provenance source before relying on it.";

/** Which section of the drug record a passage was extracted from. */
export const PassageSectionSchema = z.enum([
  "overview",
  "mechanism",
  "indications",
  "contraindications",
  "dosing",
  "pharmacokinetics",
  "interactions",
  "boxed-warning",
  "dosage-and-administration",
  "warnings-and-precautions",
  "adverse-reactions",
  "use-in-specific-populations",
  "overdosage",
  "patient-summary",
]);
export type PassageSection = z.infer<typeof PassageSectionSchema>;

/**
 * How a retrieval request was answered:
 *  - `embedding` : cosine similarity over precomputed pgvector
 *    embeddings (query embedded at request time).
 *  - `lexical`   : TF-IDF fallback over the same passages, used when
 *    no embeddings provider / vector store is available. Same shape,
 *    weaker recall — `method` lets callers tell the difference.
 */
export const RetrievalMethodSchema = z.enum(["embedding", "lexical"]);
export type RetrievalMethod = z.infer<typeof RetrievalMethodSchema>;

export const SemanticPassageSchema = z.object({
  /** Stable passage id: `<drug-slug>#<section>[:<chunk>]`. */
  id: z.string(),
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  section: PassageSectionSchema,
  /** Zero-based chunk index within the section. */
  chunk: z.number().int().nonnegative(),
  text: z.string(),
  /**
   * Relevance in 0..1. Cosine similarity on the embedding path; a
   * max-normalised TF-IDF score on the lexical path. Comparable within
   * one response, not across methods.
   */
  score: z.number(),
  provenance: ProvenanceSchema,
});
export type SemanticPassage = z.infer<typeof SemanticPassageSchema>;

export const SemanticSearchResponseSchema = z.object({
  query: z.string(),
  method: RetrievalMethodSchema,
  /** Embedding model id when `method` is `embedding`. */
  model: z.string().optional(),
  results: z.array(SemanticPassageSchema),
  total: z.number().int().nonnegative(),
  disclaimer: z.string(),
});
export type SemanticSearchResponse = z.infer<
  typeof SemanticSearchResponseSchema
>;

// ────────────────────────────────────────────────────────────────────────
// Grounded retrieval (paid tier)
// ────────────────────────────────────────────────────────────────────────

export const GroundedRequestSchema = z.object({
  /** Natural-language question or topic to retrieve passages for. */
  query: z.string().min(3).max(500),
  /** Max passages to return (1–20, default 8). */
  limit: z.number().int().min(1).max(20).default(8),
  /** Restrict retrieval to these drug-record sections. */
  sections: z.array(PassageSectionSchema).optional(),
});
export type GroundedRequest = z.infer<typeof GroundedRequestSchema>;

/**
 * One citable source. Every grounded passage points at exactly one
 * citation; the citation carries the full audit trail (canonical
 * source URL, content hash, extraction timestamp + pipeline,
 * confidence) so an LLM consumer can attach a verifiable reference to
 * every token it copies out of `text`.
 */
export const GroundedCitationSchema = z.object({
  /** Response-local citation id (`c1`, `c2`, ...). */
  id: z.string(),
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  section: PassageSectionSchema,
  passageId: z.string(),
  /** Permalink to the human-readable record. */
  url: z.string(),
  provenance: ProvenanceSchema,
});
export type GroundedCitation = z.infer<typeof GroundedCitationSchema>;

/**
 * Character-offset grounding: `[start, end)` of the passage `text`
 * attributed to `citationId`. Passages are verbatim spans of a single
 * source record, so every token of every passage is covered — an LLM
 * can cite at whatever granularity it quotes.
 */
export const GroundingSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  citationId: z.string(),
});
export type GroundingSpan = z.infer<typeof GroundingSpanSchema>;

export const GroundedPassageSchema = z.object({
  id: z.string(),
  citationId: z.string(),
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  section: PassageSectionSchema,
  chunk: z.number().int().nonnegative(),
  text: z.string(),
  score: z.number(),
  /** Full-coverage span → citation mapping over `text`. */
  grounding: z.array(GroundingSpanSchema),
});
export type GroundedPassage = z.infer<typeof GroundedPassageSchema>;

export const GroundedResponseSchema = z.object({
  query: z.string(),
  method: RetrievalMethodSchema,
  model: z.string().optional(),
  passages: z.array(GroundedPassageSchema),
  citations: z.array(GroundedCitationSchema),
  usage: z.object({
    /** Tier of the API key that made the call. */
    tier: z.string(),
    /** Lifetime request count for this key (db-backed keys only). */
    requestCount: z.number().int().nonnegative().optional(),
  }),
  disclaimer: z.string(),
});
export type GroundedResponse = z.infer<typeof GroundedResponseSchema>;
