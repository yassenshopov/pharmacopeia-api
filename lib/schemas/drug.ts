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

/**
 * One labeled indication. `icd10` and `snomed` carry standard clinical
 * codes — reference cross-links for joining against EHR/research
 * datasets, never diagnostic guidance. Both are empty until the
 * crosswalk ingest lands (roadmap: icd10-snomed-crosswalks). ICD-10-CM
 * is public domain in the US; SNOMED CT codes are included only where
 * licensable (IHTSDO member countries — the v0 dataset is US-FDA only)
 * and may stay empty where no confident concept mapping exists.
 */
export const IndicationSchema = z.object({
  text: z.string(),
  icd10: z.array(z.string()).default([]),
  snomed: z.array(z.string()).default([]),
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

/**
 * Verbatim narrative excerpts lifted from the structured-product-label
 * sections of the openFDA drug label. These are reference text, not
 * parsed structured data — the structured `dosing[]` rows and ICD-10
 * codes are reserved for the later LLM-extraction stage. Each field is
 * optional because not every label populates every section.
 */
export const LabelSectionsSchema = z.object({
  boxedWarning: z.string().optional(),
  dosageAndAdministration: z.string().optional(),
  warningsAndPrecautions: z.string().optional(),
  adverseReactions: z.string().optional(),
  useInSpecificPopulations: z.string().optional(),
  overdosage: z.string().optional(),
});
export type LabelSections = z.infer<typeof LabelSectionsSchema>;

/** DEA controlled-substance schedule (I most restrictive, V least). */
export const DeaScheduleSchema = z.enum(["I", "II", "III", "IV", "V"]);
export type DeaSchedule = z.infer<typeof DeaScheduleSchema>;

/**
 * DEA controlled-substance classification, attached by a conservative
 * curated crosswalk (`lib/ingest/controlled-substances.ts`) keyed on the
 * drug's active ingredients. A public, structured regulatory fact — not
 * prescribing or diversion-control guidance. Absent when the drug is not
 * a scheduled substance (or the crosswalk has no confident match).
 */
export const ControlledSubstanceSchema = z.object({
  schedule: DeaScheduleSchema,
  /** DEA "narcotic" designation, where it applies. */
  narcotic: z.boolean().optional(),
  /** Short reference note describing the schedule. */
  description: z.string(),
});
export type ControlledSubstance = z.infer<typeof ControlledSubstanceSchema>;

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
 * 2D chemical structure record for a single small molecule.
 *
 * Sourced from PubChem (NIH) at ingest time. SMILES is the canonical
 * representation; the SVG diagram is rendered from it via openchemlib
 * and persisted as a static asset under `public/structures/<slug>.svg`.
 *
 * Optional on the drug record because biologics, mixtures, and
 * combination products don't have a clean single-molecule SVG; we'd
 * rather omit the diagram than fake one.
 */
export const ChemicalStructureSchema = z.object({
  smiles: z.string().min(1),
  inchiKey: z.string().optional(),
  iupacName: z.string().optional(),
  pubchemCid: z.number().int().positive().optional(),
  structureSvgPath: z
    .string()
    .regex(/^\/structures\/[a-z0-9-]+\.svg$/, "must be /structures/<slug>.svg"),
  provenance: ProvenanceSchema,
});
export type ChemicalStructure = z.infer<typeof ChemicalStructureSchema>;

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
  /**
   * Verbatim narrative from the openFDA drug label "Drug Interactions"
   * section. One-sided (this drug × everything), not a pair-graph row,
   * so it lives on the Drug record instead of in `Interaction[]`. The
   * pair-graph `Interaction` schema is reserved for the day a real
   * structured DDI source lands.
   */
  interactionsNarrative: z.string().optional(),
  /**
   * Verbatim FDA structured-product-label narrative sections (boxed
   * warning, dosage, adverse reactions, etc.). Reference text from the
   * same openFDA label as the drug-level provenance.
   */
  labelSections: LabelSectionsSchema.optional(),
  /**
   * DEA controlled-substance schedule, where the drug is a scheduled
   * substance. Filled by a conservative curated crosswalk; reference
   * regulatory fact, never prescribing guidance.
   */
  controlledSubstance: ControlledSubstanceSchema.optional(),
  identifiers: IdentifierSchema,
  chemical: ChemicalStructureSchema.optional(),
  provenance: ProvenanceSchema,
});
export type Drug = z.infer<typeof DrugSchema>;
