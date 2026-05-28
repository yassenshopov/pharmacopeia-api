import { z } from "zod";
import { DrugClassRefSchema } from "./drug-class";
import { IngredientRefSchema } from "./ingredient";
import {
  JurisdictionSchema,
  ProvenanceSchema,
  SeveritySchema,
  SlugSchema,
} from "./shared";

/**
 * The Drug entity. Slug-keyed, jurisdiction-tagged, and stamped with
 * per-record provenance so every field is auditable back to a source.
 */

export const IndicationSchema = z.object({
  text: z.string(),
  icd10: z.array(z.string()).default([]),
});

export const ContraindicationSchema = z.object({
  text: z.string(),
  severity: SeveritySchema,
});

export const DosingSchema = z.object({
  route: z.enum([
    "oral",
    "iv",
    "im",
    "subcutaneous",
    "topical",
    "inhaled",
    "intranasal",
    "rectal",
    "ophthalmic",
    "otic",
    "transdermal",
    "other",
  ]),
  population: z.enum([
    "adult",
    "pediatric",
    "geriatric",
    "renal-impairment",
    "hepatic-impairment",
    "pregnancy",
  ]),
  condition: z.string().optional(),
  dose: z.string(),
  frequency: z.string().optional(),
  maxDose: z.string().optional(),
  notes: z.string().optional(),
});

export const PharmacokineticsSchema = z.object({
  halfLife: z.string().optional(),
  tMax: z.string().optional(),
  bioavailability: z.string().optional(),
  proteinBinding: z.string().optional(),
  metabolism: z.string().optional(),
  excretion: z.string().optional(),
});

export const MechanismSchema = z.object({
  summary: z.string(),
  targets: z.array(z.string()).default([]),
});

export const ApprovalSchema = z.object({
  date: z.string().date(),
  applicationNumber: z.string(),
  type: z.enum(["NDA", "ANDA", "BLA", "OTC"]),
  sponsor: z.string().optional(),
});

export const IdentifierSchema = z.object({
  rxcui: z.string().optional(),
  ndc: z.array(z.string()).default([]),
  atc: z.array(z.string()).default([]),
  drugbank: z.string().optional(),
  chembl: z.string().optional(),
  pubchem: z.string().optional(),
  unii: z.string().optional(),
});

/**
 * Compact Drug record returned by list/search endpoints. Keeps payloads
 * cheap when the caller just wants names and identifiers.
 */
export const DrugSummarySchema = z.object({
  slug: SlugSchema,
  name: z.string(),
  synonyms: z.array(z.string()).default([]),
  jurisdiction: JurisdictionSchema,
  ingredients: z.array(IngredientRefSchema),
  brands: z.array(z.string()).default([]),
  classes: z.array(DrugClassRefSchema).default([]),
  shortDescription: z.string().optional(),
});
export type DrugSummary = z.infer<typeof DrugSummarySchema>;

/**
 * Full Drug record returned by `/api/v1/drug/[slug]`.
 *
 * Sections are independently provenanced inside the database; here we
 * flatten them into one response object for ergonomics.
 */
export const DrugSchema = DrugSummarySchema.extend({
  mechanism: MechanismSchema.optional(),
  indications: z.array(IndicationSchema).default([]),
  contraindications: z.array(ContraindicationSchema).default([]),
  dosing: z.array(DosingSchema).default([]),
  pharmacokinetics: PharmacokineticsSchema.optional(),
  approvalHistory: z.array(ApprovalSchema).default([]),
  patientSummary: z.string().optional(),
  identifiers: IdentifierSchema,
  provenance: ProvenanceSchema,
});
export type Drug = z.infer<typeof DrugSchema>;
