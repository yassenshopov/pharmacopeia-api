import { invalid, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import {
  PassageSectionSchema,
  SEMANTIC_DISCLAIMER,
  type PassageSection,
  type SemanticSearchResponse,
} from "@/lib/schemas";

/**
 * GET /api/v1/semantic-search?q=...&limit=8&sections=mechanism,dosing
 *
 * Meaning-based retrieval over drug-record passages. Embedding-backed
 * (pgvector cosine) when the Postgres backend and an embeddings
 * provider are configured; otherwise a lexical TF-IDF fallback over
 * the same passages. `method` in the response reports which.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return invalid("Query parameter 'q' is required (min 3 characters)");
  }
  if (q.length > 500) {
    return invalid("Query parameter 'q' must be at most 500 characters");
  }
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("limit") ?? "8", 10) || 8, 1),
    20,
  );

  let sections: PassageSection[] | undefined;
  const sectionsParam = url.searchParams.get("sections");
  if (sectionsParam) {
    const parsed = sectionsParam
      .split(",")
      .map((s) => PassageSectionSchema.safeParse(s.trim()));
    const bad = parsed.find((p) => !p.success);
    if (bad) {
      return invalid(
        `Invalid section filter; valid sections: ${PassageSectionSchema.options.join(", ")}`,
      );
    }
    sections = parsed.map((p) => (p as { success: true; data: PassageSection }).data);
  }

  const { method, model, results } = await getRepository().searchPassages(q, {
    limit,
    sections,
  });
  return ok(
    {
      query: q,
      method,
      ...(model ? { model } : {}),
      results,
      total: results.length,
      disclaimer: SEMANTIC_DISCLAIMER,
    } satisfies SemanticSearchResponse,
    { request },
  );
}
