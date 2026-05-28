import { invalid, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { SearchResponse } from "@/lib/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.trim().length < 1) {
    return invalid("Query parameter 'q' is required");
  }
  const limit = Math.min(
    Math.max(
      Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10,
      1,
    ),
    50,
  );
  const results = await getRepository().search(q, limit);
  return ok({ query: q, results, total: results.length } satisfies SearchResponse);
}
