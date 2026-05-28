import { z } from "zod";
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
