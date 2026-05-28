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

export interface Operation {
  /** camelCase method name; snake_cased automatically for Python. */
  name: string;
  method: HttpMethod;
  /** Path template under the API base, e.g. `/drug/{slug}`. */
  path: string;
  summary: string;
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

export const OPERATIONS: readonly Operation[] = [
  {
    name: "listDrugs",
    method: "GET",
    path: "/drugs",
    summary: "List drugs (paginated), optionally filtered by class or ingredient.",
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
    pathParams: ["slug"],
    responseSchema: "Drug",
  },
  {
    name: "getDrugInteractions",
    method: "GET",
    path: "/drug/{slug}/interactions",
    summary: "List known interactions for a drug.",
    pathParams: ["slug"],
    responseSchema: "DrugInteractionsResponse",
  },
  {
    name: "getSimilarDrugs",
    method: "GET",
    path: "/drug/{slug}/similar",
    summary: "Structurally similar drugs (Tanimoto over 2D fingerprints).",
    pathParams: ["slug"],
    responseSchema: "SimilarDrugsResponse",
  },
  {
    name: "listClasses",
    method: "GET",
    path: "/classes",
    summary: "List drug classes (paginated).",
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
    pathParams: ["slug"],
    responseSchema: "ClassDetailResponse",
  },
  {
    name: "listIngredients",
    method: "GET",
    path: "/ingredients",
    summary: "List active ingredients (paginated).",
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
    pathParams: ["slug"],
    responseSchema: "Ingredient",
  },
  {
    name: "listBrands",
    method: "GET",
    path: "/brands",
    summary: "Brand → generic crosswalk for every brand in the dataset.",
    responseSchema: "BrandsResponse",
  },
  {
    name: "getStats",
    method: "GET",
    path: "/stats",
    summary: "Dataset counts and version metadata.",
    responseSchema: "Stats",
  },
  {
    name: "search",
    method: "GET",
    path: "/search",
    summary: "Full-text search across drugs, classes, and ingredients.",
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
    requestSchema: "InteractionCheckRequest",
    responseSchema: "InteractionCheckResponse",
  },
] as const;
