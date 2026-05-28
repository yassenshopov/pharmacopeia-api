import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

export const IngredientRefSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  strength: z.string().optional(),
});
export type IngredientRef = z.infer<typeof IngredientRefSchema>;

export const IngredientSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  synonyms: z.array(z.string()).default([]),
  rxcui: z.string().optional(),
  unii: z.string().optional(),
  smiles: z.string().optional(),
  inchikey: z.string().optional(),
  molecularFormula: z.string().optional(),
  molecularWeight: z.number().positive().optional(),
  drugCount: z.number().int().nonnegative(),
  provenance: ProvenanceSchema,
});
export type Ingredient = z.infer<typeof IngredientSchema>;
