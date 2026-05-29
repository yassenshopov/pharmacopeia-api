import { z } from "zod";
import { ChangelogEntrySchema } from "./changelog";
import { DrugClassSchema } from "./drug-class";
import { DrugSummarySchema } from "./drug";
import { IngredientSchema } from "./ingredient";
import { InteractionSchema } from "./interaction";
import { PaginationSchema, SlugSchema } from "./shared";

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
 *  - `status`    : always `"ok"` when the route returns 200.
 *  - `version`   : current dataset snapshot identifier (matches
 *                  `Stats.version`).
 *  - `updatedAt` : ISO timestamp of the current dataset snapshot.
 *  - `time`      : ISO timestamp the response was generated, for clock
 *                  skew and freshness checks.
 *  - `uptime`    : process uptime in whole seconds, when available.
 */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  updatedAt: z.string(),
  time: z.string(),
  uptime: z.number().int().nonnegative().optional(),
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
