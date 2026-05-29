import { z } from "zod";
import {
  ApiErrorSchema,
  ApprovalSchema,
  BrandEntrySchema,
  BrandsResponseSchema,
  ChangelogActionSchema,
  ChangelogEntrySchema,
  ChangelogKindSchema,
  ChangelogResponseSchema,
  ChemicalStructureSchema,
  ClassDetailResponseSchema,
  ClassListResponseSchema,
  ContraindicationSchema,
  DosingSchema,
  DrugClassKindSchema,
  DrugClassParentSchema,
  DrugClassRefSchema,
  DrugClassSchema,
  DrugInteractionsResponseSchema,
  DrugListResponseSchema,
  DrugRefSchema,
  DrugSchema,
  DrugSummarySchema,
  HealthResponseSchema,
  IdentifierSchema,
  IndicationSchema,
  IngredientListResponseSchema,
  IngredientRefSchema,
  IngredientSchema,
  InteractionCheckRequestSchema,
  InteractionCheckResponseSchema,
  InteractionSchema,
  InteractionSummarySchema,
  JurisdictionSchema,
  LabelSectionsSchema,
  MechanismSchema,
  PaginationSchema,
  PharmacokineticsSchema,
  ProvenanceSchema,
  SearchResponseSchema,
  SearchResultSchema,
  SeveritySchema,
  SimilarDrugResultSchema,
  SimilarDrugsResponseSchema,
  StatsSchema,
  StructureMatchSchema,
  StructureSearchRequestSchema,
  StructureSearchResponseSchema,
} from "@/lib/schemas";

/**
 * Single registry of every named type exposed by the public API. The
 * SDK code generator turns this into JSON Schema (via Zod's native
 * `toJSONSchema`) and then into TypeScript types and Python models, so
 * the clients describe payloads with the exact same definitions the API
 * validates against.
 *
 * Order is significant: it controls the order types are emitted into the
 * generated files, keeping diffs stable.
 */
export const SCHEMA_REGISTRY: ReadonlyArray<
  readonly [name: string, schema: z.ZodType]
> = [
  ["Jurisdiction", JurisdictionSchema],
  ["Severity", SeveritySchema],
  ["DrugClassKind", DrugClassKindSchema],
  ["Provenance", ProvenanceSchema],
  ["Pagination", PaginationSchema],
  ["ApiError", ApiErrorSchema],
  ["DrugRef", DrugRefSchema],
  ["Indication", IndicationSchema],
  ["Contraindication", ContraindicationSchema],
  ["Dosing", DosingSchema],
  ["Pharmacokinetics", PharmacokineticsSchema],
  ["Mechanism", MechanismSchema],
  ["Approval", ApprovalSchema],
  ["LabelSections", LabelSectionsSchema],
  ["Identifier", IdentifierSchema],
  ["ChemicalStructure", ChemicalStructureSchema],
  ["DrugClassRef", DrugClassRefSchema],
  ["DrugClassParent", DrugClassParentSchema],
  ["DrugClass", DrugClassSchema],
  ["IngredientRef", IngredientRefSchema],
  ["Ingredient", IngredientSchema],
  ["DrugSummary", DrugSummarySchema],
  ["Drug", DrugSchema],
  ["Interaction", InteractionSchema],
  ["InteractionSummary", InteractionSummarySchema],
  ["InteractionCheckRequest", InteractionCheckRequestSchema],
  ["InteractionCheckResponse", InteractionCheckResponseSchema],
  ["Stats", StatsSchema],
  ["HealthResponse", HealthResponseSchema],
  ["SimilarDrugResult", SimilarDrugResultSchema],
  ["BrandEntry", BrandEntrySchema],
  ["SearchResult", SearchResultSchema],
  ["DrugListResponse", DrugListResponseSchema],
  ["ClassListResponse", ClassListResponseSchema],
  ["IngredientListResponse", IngredientListResponseSchema],
  ["DrugInteractionsResponse", DrugInteractionsResponseSchema],
  ["SimilarDrugsResponse", SimilarDrugsResponseSchema],
  ["ClassDetailResponse", ClassDetailResponseSchema],
  ["BrandsResponse", BrandsResponseSchema],
  ["SearchResponse", SearchResponseSchema],
  ["StructureMatch", StructureMatchSchema],
  ["StructureSearchRequest", StructureSearchRequestSchema],
  ["StructureSearchResponse", StructureSearchResponseSchema],
  ["ChangelogKind", ChangelogKindSchema],
  ["ChangelogAction", ChangelogActionSchema],
  ["ChangelogEntry", ChangelogEntrySchema],
  ["ChangelogResponse", ChangelogResponseSchema],
] as const;

export type SchemaName = (typeof SCHEMA_REGISTRY)[number][0];

export interface JsonSchemaObject {
  type?: string | string[];
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaObject[];
  $ref?: string;
  description?: string;
  default?: unknown;
  [key: string]: unknown;
}

export interface SchemaBundle {
  /** Ordered type names, matching registry order. */
  order: string[];
  /** name -> JSON Schema (with `$ref: "#/$defs/<Name>"` cross-links). */
  defs: Record<string, JsonSchemaObject>;
}

/**
 * Convert the registry into a bundle of JSON Schemas keyed by type name,
 * with cross-references expressed as `#/$defs/<Name>`.
 */
export function buildSchemaBundle(): SchemaBundle {
  const registry = z.registry<{ id: string }>();
  for (const [name, schema] of SCHEMA_REGISTRY) {
    registry.add(schema, { id: name });
  }

  const out = z.toJSONSchema(registry, {
    uri: (id) => `#/$defs/${id}`,
  }) as { schemas: Record<string, JsonSchemaObject> };

  return {
    order: SCHEMA_REGISTRY.map(([name]) => name),
    defs: out.schemas,
  };
}
