import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DEFAULT_BASE_URL,
  PharmacopeiaClient,
  PharmacopeiaError,
} from "@pharmacopeia/client";
import { z } from "zod";

/**
 * Model Context Protocol server for the pharmacopeia API.
 *
 * Exposes the same operations the typed TS / Python SDKs do, but as MCP
 * tools that Claude, Cursor, Codex, and other agents can call directly.
 * Each tool is a thin wrapper over a generated client method, so the
 * tool surface can never drift from the live API contract — adding an
 * endpoint to the manifest, re-running codegen, and re-publishing this
 * package is the whole upgrade path.
 *
 * The server is transport-agnostic: `createPharmacopeiaServer` returns
 * a configured `McpServer` and the caller decides how to connect it.
 * The shipped `bin.ts` connects over stdio so an MCP host can spawn it
 * with `npx pharmacopeia-mcp`.
 */

export interface CreateServerOptions {
  /** Override the API base URL. Defaults to the production endpoint. */
  baseUrl?: string;
  /** Optional bearer token, forwarded as `Authorization: Bearer …`. */
  apiKey?: string;
  /** Inject a client instance (mostly for tests). */
  client?: PharmacopeiaClient;
}

const PACKAGE_NAME = "pharmacopeia-mcp";
const PACKAGE_VERSION = "0.1.0";

const SERVER_INSTRUCTIONS = `pharmacopeia — developer-first reference API for medications.

Use these tools to look up drug records (mechanism, indications,
identifiers, structure), pairwise interactions, structural analogs by
SMILES, and the WHO ATC / mechanism-of-action hierarchy. All data is
public-source (RxNav, openFDA, PubChem) and intended for educational
reference only — never clinical decision support, never a substitute
for professional advice. Always echo that caveat in summaries.`;

/**
 * JSON-stringify a payload and wrap it as a single MCP text-content
 * block. Stable across every tool so the agent always parses the same
 * envelope. Pretty-printed to two spaces because token cost is the same
 * either way and humans-in-the-loop read these too.
 */
function jsonResult(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function errorResult(err: unknown) {
  if (err instanceof PharmacopeiaError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `pharmacopeia API error (${err.status}${err.code ? ` ${err.code}` : ""}): ${err.message}`,
        },
      ],
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Unexpected error: ${msg}` }],
  };
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return jsonResult(await fn());
  } catch (err) {
    return errorResult(err);
  }
}

export function createPharmacopeiaServer(
  options: CreateServerOptions = {},
): McpServer {
  const client =
    options.client ??
    new PharmacopeiaClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });

  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  // ── Drugs ────────────────────────────────────────────────────────
  server.tool(
    "list_drugs",
    "List drugs (paginated) with optional class and ingredient filters. Returns lightweight DrugSummary records — pass a slug to `get_drug` for the full record.",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
      drugClass: z
        .string()
        .optional()
        .describe("Filter to drugs in this class slug (e.g. `ace-inhibitors`)."),
      ingredient: z
        .string()
        .optional()
        .describe("Filter to drugs containing this ingredient slug."),
    },
    async ({ limit, offset, drugClass, ingredient }) =>
      run(() =>
        client.listDrugs({
          ...(limit !== undefined ? { limit } : {}),
          ...(offset !== undefined ? { offset } : {}),
          ...(drugClass !== undefined ? { drugClass } : {}),
          ...(ingredient !== undefined ? { ingredient } : {}),
        }),
      ),
  );

  server.tool(
    "get_drug",
    "Fetch a full drug record by slug. Includes mechanism, indications, identifiers, FDA label sections, and provenance.",
    { slug: z.string().describe("Stable lowercase-hyphen drug slug.") },
    async ({ slug }) => run(() => client.getDrug(slug)),
  );

  server.tool(
    "get_drugs_batch",
    "Resolve up to 100 drug slugs in a single call. Returns the found records plus the slugs that did not resolve.",
    {
      slugs: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe("Up to 100 drug slugs."),
    },
    async ({ slugs }) => run(() => client.getDrugsBatch({ slugs })),
  );

  server.tool(
    "get_drug_interactions",
    "List structured pairwise interactions for a drug. Severity-graded; the pair-graph dataset is currently sparse, so empty results are normal for many drugs.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getDrugInteractions(slug)),
  );

  server.tool(
    "get_similar_drugs",
    "Structurally similar drugs by 2D Tanimoto fingerprint. Returns the closest analogs from the dataset — STRUCTURAL proximity only, never a claim of therapeutic equivalence.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getSimilarDrugs(slug)),
  );

  // ── Classes / Ingredients / Brands ───────────────────────────────
  server.tool(
    "list_classes",
    "List drug classes (paginated). RxClass-style: ATC, EPC, MoA, MeSH.",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ limit, offset }) =>
      run(() =>
        client.listClasses({
          ...(limit !== undefined ? { limit } : {}),
          ...(offset !== undefined ? { offset } : {}),
        }),
      ),
  );

  server.tool(
    "get_class",
    "Fetch a single drug class by slug, with the drugs that belong to it.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getClass(slug)),
  );

  server.tool(
    "list_ingredients",
    "List active ingredients (paginated).",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ limit, offset }) =>
      run(() =>
        client.listIngredients({
          ...(limit !== undefined ? { limit } : {}),
          ...(offset !== undefined ? { offset } : {}),
        }),
      ),
  );

  server.tool(
    "get_ingredient",
    "Fetch a single ingredient by slug.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getIngredient(slug)),
  );

  server.tool(
    "list_brands",
    "Brand → generic crosswalk across the entire dataset.",
    {},
    async () => run(() => client.listBrands()),
  );

  // ── Search ───────────────────────────────────────────────────────
  server.tool(
    "search",
    "Full-text search across drugs, classes, and ingredients. Returns a ranked list of matches.",
    {
      q: z.string().min(1).describe("Search query."),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ q, limit }) =>
      run(() =>
        client.search({ q, ...(limit !== undefined ? { limit } : {}) }),
      ),
  );

  server.tool(
    "structure_search",
    "Rank drugs in the dataset by 2D Tanimoto similarity to a SMILES string. Structural proximity only.",
    {
      smiles: z.string().min(1).describe("SMILES string for the query molecule."),
      limit: z.number().int().min(1).max(50).optional(),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum Tanimoto similarity (0–1)."),
    },
    async ({ smiles, limit, threshold }) =>
      run(() =>
        client.structureSearch({
          smiles,
          limit: limit ?? 10,
          threshold: threshold ?? 0,
        }),
      ),
  );

  // ── Interactions ─────────────────────────────────────────────────
  server.tool(
    "check_interactions",
    "Check 2–20 drug slugs for pairwise interactions. Severity-graded reference data, NOT clinical decision support — always surface the educational-use disclaimer in summaries.",
    {
      drugs: z
        .array(z.string())
        .min(2)
        .max(20)
        .describe("2–20 drug slugs to check pairwise."),
    },
    async ({ drugs }) => run(() => client.checkInteractions({ drugs })),
  );

  // ── Shortages / FAERS / Literature ───────────────────────────────
  server.tool(
    "get_drug_shortages",
    "FDA shortage entries for a drug (active, resolved, discontinuation). Reference statistics only — for live status, consult the FDA shortages database.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getDrugShortages(slug)),
  );

  server.tool(
    "list_shortages",
    "Every FDA shortage entry across the dataset.",
    {},
    async () => run(() => client.listShortages()),
  );

  server.tool(
    "get_drug_adverse_events",
    "Aggregate FAERS report counts for a drug — top reactions by reporting volume. FAERS reports are voluntarily submitted and are NOT incidence rates, signals, or causality. ALWAYS surface that framing when summarising.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getDrugAdverseEvents(slug)),
  );

  server.tool(
    "get_drug_literature",
    "Curated PubMed references for a drug (pinned to MeSH major topic). Empty list means no high-quality match, not 'no literature exists'.",
    { slug: z.string() },
    async ({ slug }) => run(() => client.getDrugLiterature(slug)),
  );

  // ── Reactions (MedDRA PT directory derived from FAERS) ────────────
  server.tool(
    "list_reactions",
    "Browse MedDRA Preferred Terms reported to FAERS across the dataset, ordered by total reporting volume. Reference statistics only — NOT a symptom checker, NOT diagnostic. ALWAYS preserve that framing when summarising results.",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ limit, offset }) =>
      run(() =>
        client.listReactions({
          ...(limit !== undefined ? { limit } : {}),
          ...(offset !== undefined ? { offset } : {}),
        }),
      ),
  );

  server.tool(
    "get_reaction",
    "Fetch a single MedDRA Preferred Term. Returns per-drug breakdown (count + share of matched FAERS reports), related reactions ranked by Jaccard similarity over drug-id sets, AND a `meta` block (when available) with the matching NLM MeSH descriptor id, the librarian-written scope note (treat as a quoted definition — do not paraphrase or extend), tree position, and recent PubMed papers indexed under the descriptor as a MeSH major topic. Counts reflect reporting volume, NOT incidence or causality. `meta` is null for MedDRA administrative terms (e.g. \"Drug Ineffective\") that have no MeSH counterpart. Alias spellings (Diarrhea ↔ Diarrhoea) resolve to the canonical record.",
    {
      slug: z
        .string()
        .describe(
          "Reaction slug, e.g. `diarrhoea`, `nausea`, `international-normalised-ratio-increased`.",
        ),
    },
    async ({ slug }) => run(() => client.getReaction(slug)),
  );

  // ── Platform / meta ──────────────────────────────────────────────
  server.tool(
    "get_stats",
    "Dataset counts and version metadata.",
    {},
    async () => run(() => client.getStats()),
  );

  server.tool(
    "get_health",
    "Liveness + dataset-version probe. Reports the active repository backend and deployment commit.",
    {},
    async () => run(() => client.getHealth()),
  );

  server.tool(
    "list_changelog",
    "Recent record-level changes (same entries the public RSS / JSON Feed advertise).",
    {
      limit: z.number().int().min(1).max(200).optional(),
      since: z
        .string()
        .optional()
        .describe("ISO-8601 timestamp; only entries strictly after this are returned."),
    },
    async ({ limit, since }) =>
      run(() =>
        client.listChangelog({
          ...(limit !== undefined ? { limit } : {}),
          ...(since !== undefined ? { since } : {}),
        }),
      ),
  );

  return server;
}

export { PharmacopeiaClient, PharmacopeiaError, DEFAULT_BASE_URL };
