import type { SchemaName } from "./registry";

/**
 * The API surface, described once. Both SDK clients (TypeScript and
 * Python) and the OpenAPI document are generated from this manifest, so
 * adding or changing an endpoint is a single edit here plus a re-run of
 * `npm run codegen`.
 */

export type HttpMethod = "GET" | "POST";

export interface QueryParam {
  /** Wire name as it appears in the query string. */
  name: string;
  /** Identifier-safe name for languages where `name` is a keyword. */
  argName?: string;
  type: "string" | "number";
  required?: boolean;
  description?: string;
}

export type OperationTag =
  | "Drugs"
  | "Classes"
  | "Ingredients"
  | "Brands"
  | "Search"
  | "Interactions"
  | "Changelog"
  | "System";

export interface Operation {
  /** camelCase method name; snake_cased automatically for Python. */
  name: string;
  method: HttpMethod;
  /** Path template under the API base, e.g. `/drug/{slug}`. */
  path: string;
  summary: string;
  /**
   * OpenAPI tag used to group operations in Scalar / Swagger UI sidebars.
   * Must match one of {@link API_TAGS}.
   */
  tag: OperationTag;
  /** Path template variables, in order. */
  pathParams?: string[];
  queryParams?: QueryParam[];
  /** Registry name of the JSON request body, if any. */
  requestSchema?: SchemaName;
  /** Registry name of the success (200) response body. */
  responseSchema: SchemaName;
}

export const API_BASE_PATH = "/api/v1";

export const DEFAULT_BASE_URL = "https://pharmacopeia.dev/api/v1";

/**
 * Top-level OpenAPI tags, in sidebar display order. Mirrors the site
 * navigation: catalog entities first, tools next, platform/meta last.
 */
export const API_TAGS: ReadonlyArray<{
  name: OperationTag;
  description: string;
}> = [
  {
    name: "Drugs",
    description:
      "Browse, fetch, and explore drugs. Includes per-drug interactions and structural neighbours.",
  },
  {
    name: "Classes",
    description:
      "RxClass-style drug classes (FDA EPC, WHO ATC, MoA, MeSH) and their members.",
  },
  {
    name: "Ingredients",
    description: "Active ingredients, the building blocks shared across drugs.",
  },
  {
    name: "Brands",
    description: "Brand → generic crosswalk across the dataset.",
  },
  {
    name: "Search",
    description:
      "Lookup by name or by 2D chemical structure (SMILES Tanimoto).",
  },
  {
    name: "Interactions",
    description:
      "Multi-drug interaction checks. Severity-graded, with mechanism and source.",
  },
  {
    name: "Changelog",
    description:
      "Record-level change feed. Typed mirror of `/feed.xml` and `/feed.json`.",
  },
  {
    name: "System",
    description: "Liveness, dataset counts, and version metadata.",
  },
];

/**
 * Higher-level groups consumed by Scalar's `x-tagGroups` extension.
 * Pure presentation; the underlying tags remain the source of truth
 * for tooling that does not understand the extension.
 */
export const API_TAG_GROUPS: ReadonlyArray<{
  name: string;
  tags: OperationTag[];
}> = [
  { name: "Catalog", tags: ["Drugs", "Classes", "Ingredients", "Brands"] },
  { name: "Tools", tags: ["Search", "Interactions"] },
  { name: "Platform", tags: ["Changelog", "System"] },
];

export const OPERATIONS: readonly Operation[] = [
  {
    name: "listDrugs",
    method: "GET",
    path: "/drugs",
    summary: "List drugs (paginated), optionally filtered by class or ingredient.",
    tag: "Drugs",
    queryParams: [
      { name: "limit", type: "number", description: "Page size (1–200, default 50)." },
      { name: "offset", type: "number", description: "Zero-based offset." },
      {
        name: "class",
        argName: "drugClass",
        type: "string",
        description: "Filter to drugs in this class slug.",
      },
      {
        name: "ingredient",
        type: "string",
        description: "Filter to drugs containing this ingredient slug.",
      },
    ],
    responseSchema: "DrugListResponse",
  },
  {
    name: "getDrug",
    method: "GET",
    path: "/drug/{slug}",
    summary: "Fetch a single drug by slug.",
    tag: "Drugs",
    pathParams: ["slug"],
    responseSchema: "Drug",
  },
  {
    name: "getDrugInteractions",
    method: "GET",
    path: "/drug/{slug}/interactions",
    summary: "List known interactions for a drug.",
    tag: "Drugs",
    pathParams: ["slug"],
    responseSchema: "DrugInteractionsResponse",
  },
  {
    name: "getSimilarDrugs",
    method: "GET",
    path: "/drug/{slug}/similar",
    summary: "Structurally similar drugs (Tanimoto over 2D fingerprints).",
    tag: "Drugs",
    pathParams: ["slug"],
    responseSchema: "SimilarDrugsResponse",
  },
  {
    name: "listClasses",
    method: "GET",
    path: "/classes",
    summary: "List drug classes (paginated).",
    tag: "Classes",
    queryParams: [
      { name: "limit", type: "number", description: "Page size (1–200, default 50)." },
      { name: "offset", type: "number", description: "Zero-based offset." },
    ],
    responseSchema: "ClassListResponse",
  },
  {
    name: "getClass",
    method: "GET",
    path: "/class/{slug}",
    summary: "Fetch a single drug class plus the drugs it contains.",
    tag: "Classes",
    pathParams: ["slug"],
    responseSchema: "ClassDetailResponse",
  },
  {
    name: "listIngredients",
    method: "GET",
    path: "/ingredients",
    summary: "List active ingredients (paginated).",
    tag: "Ingredients",
    queryParams: [
      { name: "limit", type: "number", description: "Page size (1–200, default 50)." },
      { name: "offset", type: "number", description: "Zero-based offset." },
    ],
    responseSchema: "IngredientListResponse",
  },
  {
    name: "getIngredient",
    method: "GET",
    path: "/ingredient/{slug}",
    summary: "Fetch a single ingredient by slug.",
    tag: "Ingredients",
    pathParams: ["slug"],
    responseSchema: "Ingredient",
  },
  {
    name: "listBrands",
    method: "GET",
    path: "/brands",
    summary: "Brand → generic crosswalk for every brand in the dataset.",
    tag: "Brands",
    responseSchema: "BrandsResponse",
  },
  {
    name: "getStats",
    method: "GET",
    path: "/stats",
    summary: "Dataset counts and version metadata.",
    tag: "System",
    responseSchema: "Stats",
  },
  {
    name: "getHealth",
    method: "GET",
    path: "/health",
    summary:
      "Liveness + dataset-version probe. Tiny payload for monitors and clients.",
    tag: "System",
    responseSchema: "HealthResponse",
  },
  {
    name: "search",
    method: "GET",
    path: "/search",
    summary: "Full-text search across drugs, classes, and ingredients.",
    tag: "Search",
    queryParams: [
      { name: "q", type: "string", required: true, description: "Search query." },
      { name: "limit", type: "number", description: "Max results (1–50, default 10)." },
    ],
    responseSchema: "SearchResponse",
  },
  {
    name: "checkInteractions",
    method: "POST",
    path: "/interactions/check",
    summary: "Check a set of 2–20 drug slugs for pairwise interactions.",
    tag: "Interactions",
    requestSchema: "InteractionCheckRequest",
    responseSchema: "InteractionCheckResponse",
  },
  {
    name: "structureSearch",
    method: "POST",
    path: "/structure-search",
    summary:
      "Rank drugs in the dataset by 2D Tanimoto similarity to a caller-supplied SMILES. Structural proximity only.",
    tag: "Search",
    requestSchema: "StructureSearchRequest",
    responseSchema: "StructureSearchResponse",
  },
  {
    name: "listChangelog",
    method: "GET",
    path: "/changelog",
    summary: "Recent record-level changes (typed mirror of /feed.xml and /feed.json).",
    tag: "Changelog",
    queryParams: [
      {
        name: "limit",
        type: "number",
        description: "Max entries (1–200, default 50).",
      },
      {
        name: "since",
        type: "string",
        description: "ISO-8601 timestamp; only entries strictly after this are returned.",
      },
    ],
    responseSchema: "ChangelogResponse",
  },
] as const;
