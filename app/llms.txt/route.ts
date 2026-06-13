import { getRepository } from "@/lib/data/repository";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * /llms.txt
 *
 * The emerging convention (llmstxt.org) for telling LLM crawlers and
 * coding agents how to consume a site cheaply: a short markdown index
 * with descriptions and links to the canonical machine-readable
 * surfaces. We're an API-first project whose primary consumer is a
 * coding agent — so this file is on-brand and load-bearing.
 *
 * Cached for an hour; counts are pulled live from the repository.
 */

export async function GET() {
  const repo = getRepository();
  const stats = await repo.getStats();
  const body = renderLlmsTxt(stats);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "all",
    },
  });
}

function renderLlmsTxt(stats: {
  drugs: number;
  classes: number;
  ingredients: number;
  interactions: number;
  indications: number;
  version: string;
  updatedAt: string;
}): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);
  const link = (label: string, path: string, note?: string) =>
    push(`- [${label}](${absoluteUrl(path)})${note ? `: ${note}` : ""}`);

  push("# pharmacopeia");
  push();
  push(
    "> Developer-first JSON reference API for medications. Stable slugs, versioned routes, per-record provenance, and Zod-validated payloads. Educational / informational use only — never a clinical or decision-support tool.",
  );
  push();
  push(
    `Dataset snapshot \`${stats.version}\` (updated ${stats.updatedAt}). ${stats.drugs} drugs, ${stats.classes} classes, ${stats.ingredients} ingredients, ${stats.interactions} interactions, ${stats.indications} indications.`,
  );
  push();
  push("Conventions:");
  push();
  push(
    "- Every entity is keyed by a stable lowercase-with-hyphens slug. Slugs never change.",
  );
  push(
    "- All public routes live under `/api/v1`. Breaking changes ship as `/api/v2`.",
  );
  push(
    "- Responses are `application/json; charset=utf-8` and validated against the same Zod schemas at runtime.",
  );
  push(
    "- `GET` responses ship `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` and a strong `ETag`. Clients can revalidate with `If-None-Match` for `304 Not Modified`.",
  );
  push(
    "- Every record carries a `provenance` object (`sourceUrl`, `sourceHash`, `extractedAt`, `extractor`, `confidence`).",
  );
  push();

  push("## Machine-readable surfaces");
  push();
  link("OpenAPI 3.1 document", "/api/v1/openapi.json", "the source of truth for endpoints, parameters, and response schemas");
  link("Interactive API reference", "/reference", "Scalar-rendered, try-it browser over the OpenAPI spec");
  link("Health & dataset version", "/api/v1/health", "tiny liveness + snapshot version envelope");
  link("Dataset stats", "/api/v1/stats", "counts and current snapshot version");
  link("Long-form llms file", "/llms-full.txt", "fuller index with every endpoint and its description inlined");
  push();

  push("## Core API endpoints");
  push();
  link("GET /api/v1/drugs", "/api/v1/drugs", "list drugs (paginated; filter by `?class=`, `?ingredient=`)");
  link("GET /api/v1/drug/{slug}", "/api/v1/drug/metformin", "full drug record (mechanism, indications, label sections, identifiers, provenance)");
  link("GET /api/v1/drug/{slug}/interactions", "/api/v1/drug/metformin/interactions", "all known interactions for a drug");
  link("GET /api/v1/drug/{slug}/similar", "/api/v1/drug/metformin/similar", "structurally similar drugs (Tanimoto over 2D fingerprints)");
  link("GET /api/v1/classes", "/api/v1/classes", "list pharmacological classes (ATC, EPC, MoA, MeSH)");
  link("GET /api/v1/class/{slug}", "/api/v1/class/biguanides", "class detail + drugs in the class");
  link("GET /api/v1/ingredients", "/api/v1/ingredients", "list active ingredients with chemistry identifiers");
  link("GET /api/v1/ingredient/{slug}", "/api/v1/ingredient/metformin-hydrochloride", "ingredient detail (RxCUI, UNII, SMILES, InChIKey)");
  link("GET /api/v1/brands", "/api/v1/brands", "brand → generic crosswalk");
  link("GET /api/v1/atc", "/api/v1/atc", "WHO ATC hierarchy as a nested tree (levels 1–5)");
  link("GET /api/v1/mechanisms/graph", "/api/v1/mechanisms/graph", "drug ↔ MoA ↔ molecular target graph");
  link("GET /api/v1/search?q=...", "/api/v1/search?q=blood+thinner", "full-text search across drugs, classes, ingredients");
  link("POST /api/v1/interactions/check", "/api/v1/interactions/check", "pairwise interaction check; body `{ drugs: string[] }`");
  push();

  push("## Browsable reference (HTML)");
  push();
  link("Docs", "/docs", "endpoint reference + conventions + indicator legend");
  link("Methodology", "/methodology", "data sources, provenance model, review process, and limitations");
  link("Drugs", "/drugs");
  link("Classes", "/classes");
  link("Ingredients", "/ingredients");
  link("Brands", "/brands");
  link("Conditions", "/conditions", "ICD-10-CM concepts → drugs labeled for them");
  link("ATC explorer", "/atc");
  link("Interactions", "/interactions");
  link("Compare drugs", "/compare/atorvastatin-vs-rosuvastatin", "side-by-side drug-vs-drug contrasts at /compare/{a}-vs-{b} (slugs in alphabetical order)");
  link("FAQ", "/faq");
  link("Glossary", "/glossary");
  link("Roadmap", "/roadmap");
  push();

  push("## SDKs");
  push();
  push("- TypeScript and Python clients are generated from the same Zod schemas the API validates against. See `sdk/` in the source repository.");
  push();

  push("## Optional");
  push();
  push(
    "- This project is **not** a clinical decision-support tool, EHR/FHIR layer, symptom checker, diagnostic API, or a wrapper around paid feeds. Always verify against the canonical `provenance.sourceUrl` before acting on any field.",
  );
  push();

  return lines.join("\n");
}
