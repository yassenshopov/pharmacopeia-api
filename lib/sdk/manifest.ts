import type { SchemaName } from "./registry";

/**
 * The API surface, described once. Both SDK clients (TypeScript and
 * Python) and the OpenAPI document are generated from this manifest, so
 * adding or changing an endpoint is a single edit here plus a re-run of
 * `npm run codegen`.
 */

export type HttpMethod = "GET" | "POST" | "DELETE";

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
  | "Shortages"
  | "AdverseEvents"
  | "Reactions"
  | "Literature"
  | "Retrieval"
  | "Changelog"
  | "Webhooks"
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
  /** Requires an API key (`Authorization: Bearer <key>`). */
  auth?: boolean;
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
    name: "Shortages",
    description:
      "FDA drug-shortage status crosswalk. Reference statistics only — for live status, consult the FDA shortages database directly.",
  },
  {
    name: "AdverseEvents",
    description:
      "Aggregate FAERS adverse-event report counts. Counts are reporting volume, NOT incidence rates, signals, or causality. Reference statistics only.",
  },
  {
    name: "Reactions",
    description:
      "MedDRA Preferred Terms reported to FAERS, transposed across the dataset. Each reaction lists the drugs that report it most, ranked by share of the drug's matched reports, plus related reactions by Jaccard similarity. Reference statistics only — NOT a symptom checker, NOT diagnostic.",
  },
  {
    name: "Literature",
    description:
      "PubMed PMID crosswalks. Link drug records to canonical literature in PubMed.",
  },
  {
    name: "Retrieval",
    description:
      "Meaning-based retrieval over drug-record passages. `/semantic-search` is free; `/grounded` is the key-gated tier that adds per-span citations with full provenance for LLM consumers.",
  },
  {
    name: "Changelog",
    description:
      "Record-level change feed. Typed mirror of `/feed.xml` and `/feed.json`.",
  },
  {
    name: "Webhooks",
    description:
      "Outbound webhooks on dataset changes. Deliveries are HMAC-SHA256 signed (`X-Pharmacopeia-Signature: t=<ts>,v1=<hex>` over `<ts>.<body>`). Requires an API key.",
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
  {
    name: "Tools",
    tags: [
      "Search",
      "Interactions",
      "Shortages",
      "AdverseEvents",
      "Reactions",
      "Literature",
      "Retrieval",
    ],
  },
  { name: "Platform", tags: ["Changelog", "Webhooks", "System"] },
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
    queryParams: [
      {
        name: "fields",
        type: "string",
        description:
          "Optional comma-separated list of sections to include (mechanism, indications, contraindications, dosing, pharmacokinetics, interactions, labelSections, approvalHistory, chemical, patientSummary). Identity fields are always returned. Omit for the full record.",
      },
    ],
    responseSchema: "Drug",
  },
  {
    name: "getDrugsBatch",
    method: "POST",
    path: "/drugs/batch",
    summary:
      "Fetch up to 100 drug records in a single round-trip. Returns the full records found plus the slugs that did not resolve.",
    tag: "Drugs",
    requestSchema: "DrugsBatchRequest",
    responseSchema: "DrugsBatchResponse",
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
    name: "getDrugShortages",
    method: "GET",
    path: "/drug/{slug}/shortages",
    summary:
      "FDA shortage entries (active, resolved, discontinuation) for a drug. Reference statistics only.",
    tag: "Shortages",
    pathParams: ["slug"],
    responseSchema: "DrugShortagesResponse",
  },
  {
    name: "listShortages",
    method: "GET",
    path: "/shortages",
    summary:
      "Every shortage entry across the dataset, sorted by drug then presentation.",
    tag: "Shortages",
    responseSchema: "ShortagesResponse",
  },
  {
    name: "getDrugAdverseEvents",
    method: "GET",
    path: "/drug/{slug}/adverse-events",
    summary:
      "Aggregate FAERS report counts for a drug — top reactions by reporting volume. NOT incidence rates, signals, or causality.",
    tag: "AdverseEvents",
    pathParams: ["slug"],
    responseSchema: "AdverseEventStatsResponse",
  },
  {
    name: "getDrugLiterature",
    method: "GET",
    path: "/drug/{slug}/literature",
    summary:
      "Curated PubMed references for a drug, pinned to MeSH major topic at ingest time.",
    tag: "Literature",
    pathParams: ["slug"],
    responseSchema: "DrugLiteratureResponse",
  },
  {
    name: "listReactions",
    method: "GET",
    path: "/reactions",
    summary:
      "Browse MedDRA Preferred Terms reported to FAERS across the dataset, ordered by total reporting volume. Reference statistics only — NOT a symptom checker.",
    tag: "Reactions",
    queryParams: [
      {
        name: "limit",
        type: "number",
        description: "Page size (1–200, default 50).",
      },
      { name: "offset", type: "number", description: "Zero-based offset." },
    ],
    responseSchema: "ReactionsListResponse",
  },
  {
    name: "getReaction",
    method: "GET",
    path: "/reaction/{slug}",
    summary:
      "Fetch one MedDRA Preferred Term with its per-drug breakdown (count + share of matched FAERS reports), related reactions ranked by Jaccard similarity over the drug-id sets, and optional reference metadata — NLM MeSH descriptor id, scope note, tree position, and recent PubMed papers on the term as a MeSH major topic. Alias slugs 301-redirect to canonical.",
    tag: "Reactions",
    pathParams: ["slug"],
    responseSchema: "ReactionResponse",
  },
  {
    name: "semanticSearch",
    method: "GET",
    path: "/semantic-search",
    summary:
      "Meaning-based retrieval over drug-record passages. Embedding-backed when available; lexical fallback otherwise — `method` in the response reports which.",
    tag: "Retrieval",
    queryParams: [
      {
        name: "q",
        type: "string",
        required: true,
        description: "Natural-language query (3–500 characters).",
      },
      {
        name: "limit",
        type: "number",
        description: "Max passages (1–20, default 8).",
      },
      {
        name: "sections",
        type: "string",
        description:
          "Optional comma-separated list of drug-record sections to search (e.g. mechanism,dosing,boxed-warning).",
      },
    ],
    responseSchema: "SemanticSearchResponse",
  },
  {
    name: "groundedRetrieval",
    method: "POST",
    path: "/grounded",
    summary:
      "Key-gated retrieval tier for LLM consumers: same passages as /semantic-search plus per-span citations carrying full provenance (source URL, content hash, extraction timestamp, confidence).",
    tag: "Retrieval",
    requestSchema: "GroundedRequest",
    responseSchema: "GroundedResponse",
    auth: true,
  },
  {
    name: "listWebhooks",
    method: "GET",
    path: "/webhooks",
    summary: "List the webhook endpoints registered by the calling API key.",
    tag: "Webhooks",
    responseSchema: "WebhooksListResponse",
    auth: true,
  },
  {
    name: "createWebhook",
    method: "POST",
    path: "/webhooks",
    summary:
      "Register a webhook endpoint. The response includes the HMAC signing secret exactly once — store it.",
    tag: "Webhooks",
    requestSchema: "WebhookCreateRequest",
    responseSchema: "WebhookEndpointCreated",
    auth: true,
  },
  {
    name: "deleteWebhook",
    method: "DELETE",
    path: "/webhooks/{id}",
    summary: "Delete a webhook endpoint owned by the calling API key.",
    tag: "Webhooks",
    pathParams: ["id"],
    responseSchema: "WebhookDeleteResponse",
    auth: true,
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
