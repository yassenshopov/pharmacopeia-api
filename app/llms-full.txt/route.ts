import { getRepository } from "@/lib/data/repository";
import { API_BASE_PATH, DEFAULT_BASE_URL, OPERATIONS } from "@/lib/sdk/manifest";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * /llms-full.txt
 *
 * Long-form companion to `/llms.txt`. Inlines every endpoint with its
 * method, path, summary, parameters, and response schema name so that
 * an LLM can answer "how do I call the pharmacopeia API to do X?"
 * without a follow-up fetch. Pulls live from the same OPERATIONS array
 * the SDK clients and the OpenAPI doc are built from.
 */

export async function GET() {
  const repo = getRepository();
  const stats = await repo.getStats();
  const body = renderLlmsFullTxt(stats);

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

function renderLlmsFullTxt(stats: {
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

  push("# pharmacopeia — full reference");
  push();
  push(
    "> Long-form companion to `/llms.txt`. Every public v1 endpoint, with its parameters and response schema, inlined so an LLM can answer API-usage questions without an extra fetch.",
  );
  push();
  push(`Dataset snapshot: \`${stats.version}\` (updated ${stats.updatedAt}).`);
  push(
    `Counts: ${stats.drugs} drugs, ${stats.classes} classes, ${stats.ingredients} ingredients, ${stats.interactions} interactions, ${stats.indications} indications.`,
  );
  push(`Base URL: \`${DEFAULT_BASE_URL}\` (path prefix \`${API_BASE_PATH}\`).`);
  push();

  push("## Conventions");
  push();
  push("- **Slugs are forever.** Every entity is keyed by a stable lowercase-with-hyphens slug. Slugs never change. Numeric IDs are never exposed.");
  push("- **Versioned URLs.** All public routes live under `/api/v1`. Breaking changes ship as `/api/v2`.");
  push("- **Zod-validated.** Request bodies and response payloads share the same Zod schemas the SDK clients and the OpenAPI document are generated from.");
  push("- **Cache-Control.** `GET` responses ship `public, s-maxage=3600, stale-while-revalidate=86400` and a strong `ETag`. Honor `If-None-Match` for cheap revalidation.");
  push("- **Provenance everywhere.** Every record carries a `provenance` object: `sourceUrl`, `sourceHash`, `extractedAt`, `extractor`, `confidence`.");
  push("- **Jurisdiction-tagged.** Every drug carries `jurisdiction`. v0 is `US-FDA` only.");
  push("- **No auth in v0.** Rate limits apply. Use `User-Agent` to identify yourself.");
  push("- **Errors.** Failures return `{ \"error\": { \"code\", \"message\", \"details?\" } }` with appropriate HTTP status. `code` is one of `not_found`, `invalid_request`, `internal_error`.");
  push();

  push("## Endpoints");
  push();

  for (const op of OPERATIONS) {
    const fullPath = `${API_BASE_PATH}${op.path}`;
    push(`### \`${op.method} ${fullPath}\``);
    push();
    push(op.summary);
    push();

    if (op.pathParams?.length) {
      push("Path parameters:");
      for (const p of op.pathParams) {
        push(`- \`${p}\` — string slug.`);
      }
      push();
    }

    if (op.queryParams?.length) {
      push("Query parameters:");
      for (const q of op.queryParams) {
        const flag = q.required ? " (required)" : "";
        const desc = q.description ? ` — ${q.description}` : "";
        push(`- \`${q.name}\`: ${q.type}${flag}${desc}`);
      }
      push();
    }

    if (op.requestSchema) {
      push(`Request body schema: \`${op.requestSchema}\`.`);
      push();
    }

    push(`Response schema: \`${op.responseSchema}\`.`);
    push();
    push(`Try it: ${absoluteUrl(fullPath.replace(/\{slug\}/, "metformin"))}`);
    push();
  }

  push("## Machine-readable specs");
  push();
  push(`- OpenAPI 3.1: ${absoluteUrl("/api/v1/openapi.json")}`);
  push(`- Interactive reference (Scalar): ${absoluteUrl("/reference")}`);
  push(`- Health probe: ${absoluteUrl("/api/v1/health")}`);
  push(`- Stats: ${absoluteUrl("/api/v1/stats")}`);
  push();

  push("## Browsable reference pages");
  push();
  push(`- Docs: ${absoluteUrl("/docs")}`);
  push(`- Drugs: ${absoluteUrl("/drugs")}`);
  push(`- Classes: ${absoluteUrl("/classes")}`);
  push(`- Ingredients: ${absoluteUrl("/ingredients")}`);
  push(`- Brands: ${absoluteUrl("/brands")}`);
  push(`- ATC explorer: ${absoluteUrl("/atc")}`);
  push(`- Interactions: ${absoluteUrl("/interactions")}`);
  push(`- Mechanism graph: ${absoluteUrl("/moa")}`);
  push(`- FAQ: ${absoluteUrl("/faq")}`);
  push(`- Glossary: ${absoluteUrl("/glossary")}`);
  push(`- Roadmap: ${absoluteUrl("/roadmap")}`);
  push();

  push("## Disclaimer");
  push();
  push(
    "pharmacopeia is for educational and informational use only. It is **not** medical advice, a diagnosis, a treatment recommendation, a clinical decision-support tool, or a substitute for consultation with a qualified clinician. Always verify against the canonical `provenance.sourceUrl` before acting on any field.",
  );
  push();

  return lines.join("\n");
}
