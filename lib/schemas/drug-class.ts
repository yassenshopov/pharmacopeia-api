import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * A pharmacological classification of drugs.
 *
 * `kind` mirrors the classification systems exposed by NLM RxClass:
 *  - atc       : Anatomical Therapeutic Chemical (WHO)
 *  - moa       : Mechanism of Action
 *  - epc       : Established Pharmacologic Class (FDA SPL)
 *  - pe        : Physiologic Effect
 *  - pharm     : Pharmacological Class (generic)
 *  - mesh      : Medical Subject Headings (NLM)
 */
export const DrugClassKindSchema = z.enum([
  "atc",
  "moa",
  "epc",
  "pe",
  "pharm",
  "mesh",
]);
export type DrugClassKind = z.infer<typeof DrugClassKindSchema>;

export const DrugClassRefSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  kind: DrugClassKindSchema,
  code: z.string().optional(),
});
export type DrugClassRef = z.infer<typeof DrugClassRefSchema>;

export const DrugClassParentSchema = z.object({
  slug: SlugSchema,
  name: z.string(),
});
export type DrugClassParent = z.infer<typeof DrugClassParentSchema>;

export const DrugClassSchema = DrugClassRefSchema.extend({
  description: z.string().optional(),
  parent: DrugClassParentSchema.nullable().optional(),
  drugCount: z.number().int().nonnegative(),
  provenance: ProvenanceSchema,
});
export type DrugClass = z.infer<typeof DrugClassSchema>;
