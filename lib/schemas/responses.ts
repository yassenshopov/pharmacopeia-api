import { z } from "zod";
import { ChangelogEntrySchema } from "./changelog";
import { DrugClassSchema } from "./drug-class";
import { DrugSchema, DrugSummarySchema } from "./drug";
import { IngredientSchema } from "./ingredient";
import { InteractionSchema } from "./interaction";
import { PaginationSchema, SlugSchema } from "./shared";
import { ShortageEntrySchema } from "./shortage";
import { AdverseEventStatsSchema } from "./adverse-events";
import { LiteratureReferenceSchema } from "./literature";
import { TrialEntrySchema } from "./trial";
import { PgxPairSchema } from "./pgx";
import { ReactionSchema, ReactionSummarySchema } from "./reaction";

/**
 * Response envelope schemas for the public v1 API.
 *
 * Entity schemas (Drug, DrugClass, Ingredient, ...) live in their own
 * files; this module captures the *shape of each endpoint's payload* so
 * that the generated SDK clients describe responses with the exact same
 * Zod definitions the API serves. Keep this file in sync with the route
 * handlers under `app/api/v1/` — the SDK manifest in `lib/sdk/manifest.ts`
 * maps each route to one of these schemas.
 */

/** Lightweight `{ slug, name }` reference embedded in several envelopes. */
export const DrugRefSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
});
export type DrugRef = z.infer<typeof DrugRefSchema>;

export const StatsSchema = z.object({
  drugs: z.number().int().nonnegative(),
  classes: z.number().int().nonnegative(),
  ingredients: z.number().int().nonnegative(),
  interactions: z.number().int().nonnegative(),
  indications: z.number().int().nonnegative(),
  version: z.string(),
  updatedAt: z.string(),
});
export type Stats = z.infer<typeof StatsSchema>;

/**
 * Liveness + dataset-version envelope. Intentionally tiny so monitors
 * and load balancers can poll it cheaply without parsing a real payload.
 *  - `status`     : always `"ok"` when the route returns 200.
 *  - `version`    : current dataset snapshot identifier (matches
 *                   `Stats.version`).
 *  - `updatedAt`  : ISO timestamp of the current dataset snapshot.
 *  - `time`       : ISO timestamp the response was generated, for clock
 *                   skew and freshness checks.
 *  - `uptime`     : process uptime in whole seconds, when available.
 *  - `repository` : which repository implementation is currently
 *                   serving requests — `"static"` (seed data baked into
 *                   the bundle) or `"supabase"` (live Postgres). Lets
 *                   monitors distinguish "API is up but on fallback"
 *                   from "API is up on the real backend".
 *  - `commit`     : short git SHA the deployment was built from, when
 *                   the build platform exposes one (Vercel sets
 *                   `VERCEL_GIT_COMMIT_SHA`). Absent in local dev.
 *  - `region`     : platform region serving the request (e.g.
 *                   `iad1`), when available — useful for triaging
 *                   regional outages.
 */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  updatedAt: z.string(),
  time: z.string(),
  uptime: z.number().int().nonnegative().optional(),
  repository: z.enum(["static", "supabase"]),
  commit: z.string().optional(),
  region: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const SimilarDrugResultSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  score: z.number(),
  className: z.string().optional(),
});
export type SimilarDrugResult = z.infer<typeof SimilarDrugResultSchema>;

export const BrandEntrySchema = z.object({
  brand: z.string(),
  drugs: z.array(DrugRefSchema),
});
export type BrandEntry = z.infer<typeof BrandEntrySchema>;

export const SearchResultSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["drug", "ingredient", "class"]),
  description: z.string().optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const DrugListResponseSchema = z.object({
  items: z.array(DrugSummarySchema),
  pagination: PaginationSchema,
});
export type DrugListResponse = z.infer<typeof DrugListResponseSchema>;

export const ClassListResponseSchema = z.object({
  items: z.array(DrugClassSchema),
  pagination: PaginationSchema,
});
export type ClassListResponse = z.infer<typeof ClassListResponseSchema>;

export const IngredientListResponseSchema = z.object({
  items: z.array(IngredientSchema),
  pagination: PaginationSchema,
});
export type IngredientListResponse = z.infer<
  typeof IngredientListResponseSchema
>;

export const DrugInteractionsResponseSchema = z.object({
  drug: DrugRefSchema,
  interactions: z.array(InteractionSchema),
  total: z.number().int().nonnegative(),
});
export type DrugInteractionsResponse = z.infer<
  typeof DrugInteractionsResponseSchema
>;

export const SimilarDrugsResponseSchema = z.object({
  drug: DrugRefSchema,
  method: z.literal("tanimoto-2d-fingerprint"),
  similar: z.array(SimilarDrugResultSchema),
  total: z.number().int().nonnegative(),
});
export type SimilarDrugsResponse = z.infer<typeof SimilarDrugsResponseSchema>;

/**
 * Structure-search request: a SMILES string the caller wants to look
 * up against every drug in the dataset that has a single-component
 * PubChem SMILES, ranked by 2D Tanimoto similarity. `limit` caps the
 * returned list; `threshold` filters out weak matches. Both are
 * conservative defaults so a casual query returns something useful.
 */
export const StructureSearchRequestSchema = z.object({
  smiles: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0),
});
export type StructureSearchRequest = z.infer<
  typeof StructureSearchRequestSchema
>;

export const StructureMatchSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  score: z.number(),
  className: z.string().optional(),
  smiles: z.string(),
});
export type StructureMatch = z.infer<typeof StructureMatchSchema>;

export const StructureSearchResponseSchema = z.object({
  query: z.object({
    smiles: z.string(),
    limit: z.number().int().positive(),
    threshold: z.number().min(0).max(1),
  }),
  method: z.literal("tanimoto-2d-fingerprint"),
  total: z.number().int().nonnegative(),
  results: z.array(StructureMatchSchema),
});
export type StructureSearchResponse = z.infer<
  typeof StructureSearchResponseSchema
>;

export const ClassDetailResponseSchema = DrugClassSchema.extend({
  drugs: z.array(DrugSummarySchema),
});
export type ClassDetailResponse = z.infer<typeof ClassDetailResponseSchema>;

export const BrandsResponseSchema = z.object({
  brands: z.array(BrandEntrySchema),
  total: z.number().int().nonnegative(),
});
export type BrandsResponse = z.infer<typeof BrandsResponseSchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  total: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * `/api/v1/changelog` response envelope. Mirrors `/feed.xml` and
 * `/feed.json` so consumers who already speak the typed SDK can pull
 * the same entries without parsing RSS or JSON Feed.
 */
export const ChangelogResponseSchema = z.object({
  entries: z.array(ChangelogEntrySchema),
  total: z.number().int().nonnegative(),
});
export type ChangelogResponse = z.infer<typeof ChangelogResponseSchema>;

/**
 * Batch drug lookup request: fetch many full drug records in a single
 * round-trip. Capped at 100 slugs per call so a request can't fan out
 * into a denial-of-service against the dataset, and duplicates are
 * deduped server-side so callers don't pay for redundant entries.
 */
export const DrugsBatchRequestSchema = z.object({
  slugs: z.array(SlugSchema).min(1).max(100),
});
export type DrugsBatchRequest = z.infer<typeof DrugsBatchRequestSchema>;

/**
 * Batch drug lookup response. `found` carries the full Drug records in
 * the same order the caller asked for them (with duplicates collapsed),
 * and `missing` lists the slugs that did not resolve so a caller can
 * surface them without diffing the request and the response themselves.
 */
export const DrugsBatchResponseSchema = z.object({
  found: z.array(DrugSchema),
  missing: z.array(SlugSchema),
  total: z.number().int().nonnegative(),
});
export type DrugsBatchResponse = z.infer<typeof DrugsBatchResponseSchema>;

/**
 * Per-drug shortage envelope. `entries` may contain multiple rows when
 * more than one presentation of the drug is on the FDA list (different
 * strengths or dosage forms). `anyActive` is a cheap roll-up so a UI
 * can decide whether to render a status badge without scanning the
 * list — it's true iff at least one entry has `status: "active"`.
 */
export const DrugShortagesResponseSchema = z.object({
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  entries: z.array(ShortageEntrySchema),
  anyActive: z.boolean(),
  total: z.number().int().nonnegative(),
});
export type DrugShortagesResponse = z.infer<typeof DrugShortagesResponseSchema>;

/**
 * Global shortage index envelope. Returns every shortage entry across
 * the dataset, ordered by drug slug then presentation, so a `/shortages`
 * page or a refresh monitor can iterate the whole set in one call.
 */
export const ShortagesResponseSchema = z.object({
  entries: z.array(ShortageEntrySchema),
  total: z.number().int().nonnegative(),
});
export type ShortagesResponse = z.infer<typeof ShortagesResponseSchema>;

/**
 * Per-drug FAERS aggregate envelope. Wraps `AdverseEventStats` with
 * the parent drug reference so the SDK and UI never have to fan out a
 * second drug lookup just to render the section header.
 *
 * **Reference statistics only.** See `AdverseEventStatsSchema` for the
 * full framing — counts are reporting volume, not incidence, not
 * causality.
 */
export const AdverseEventStatsResponseSchema = z.object({
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  stats: AdverseEventStatsSchema.nullable(),
});
export type AdverseEventStatsResponse = z.infer<
  typeof AdverseEventStatsResponseSchema
>;

/**
 * Per-drug PubMed literature envelope. Returns the curated list of
 * PMIDs the ingest pipeline picked for this drug (typically the
 * top-N papers with the drug as a MeSH major topic) plus the parent
 * drug reference.
 */
export const DrugLiteratureResponseSchema = z.object({
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  references: z.array(LiteratureReferenceSchema),
  total: z.number().int().nonnegative(),
});
export type DrugLiteratureResponse = z.infer<
  typeof DrugLiteratureResponseSchema
>;

/**
 * Per-drug ClinicalTrials.gov envelope. `trials` is the most recently
 * updated sample the ingest pipeline kept; `totalCount` is the full
 * registry match count for the intervention query at extraction time.
 * The `disclaimer` field travels with the payload so SDK and MCP
 * consumers inherit the framing: registration is not evidence.
 */
export const DrugTrialsResponseSchema = z.object({
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  trials: z.array(TrialEntrySchema),
  totalCount: z.number().int().nonnegative(),
  sampled: z.number().int().nonnegative(),
  disclaimer: z.string(),
});
export type DrugTrialsResponse = z.infer<typeof DrugTrialsResponseSchema>;

/**
 * Per-drug pharmacogenomics envelope. CPIC-curated drug–gene pairs
 * with evidence levels and guideline links. The `disclaimer` field
 * travels with the payload so SDK and MCP consumers inherit the
 * framing: evidence metadata, never testing or dosing guidance.
 */
export const DrugPgxResponseSchema = z.object({
  drug: z.object({ slug: SlugSchema, name: z.string() }),
  pairs: z.array(PgxPairSchema),
  total: z.number().int().nonnegative(),
  disclaimer: z.string(),
});
export type DrugPgxResponse = z.infer<typeof DrugPgxResponseSchema>;

/**
 * Reactions browse envelope. Lightweight per-row records ordered by
 * total reporting volume desc — the dense end of the FAERS distribution
 * surfaces first so the page is useful before any filtering. Capped to
 * 200 per request like every other browse endpoint in the API.
 */
export const ReactionsListResponseSchema = z.object({
  items: z.array(ReactionSummarySchema),
  pagination: PaginationSchema,
});
export type ReactionsListResponse = z.infer<typeof ReactionsListResponseSchema>;

/**
 * Reaction detail envelope. The full reaction record with per-drug
 * rows and Jaccard-ranked related reactions. The FAERS disclaimer is
 * inside `Reaction.disclaimer` itself so SDK consumers never have to
 * re-state it.
 */
export const ReactionResponseSchema = ReactionSchema;
export type ReactionResponse = z.infer<typeof ReactionResponseSchema>;
