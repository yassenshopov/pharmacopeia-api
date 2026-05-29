import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ShortagesResponse } from "@/lib/schemas";

/**
 * GET /api/v1/shortages
 *
 * Every shortage entry across the dataset, sorted by drug then
 * presentation. Powers the `/shortages` browse index and refresh
 * monitoring. The list is intentionally flat (not paginated): the
 * full FDA shortage roster is on the order of hundreds of entries,
 * not millions, and consumers benefit more from a single snapshot
 * than from page-by-page pagination.
 *
 * Reference statistics only.
 */
export async function GET(request: Request) {
  const entries = await getRepository().listShortages();
  const body: ShortagesResponse = {
    entries,
    total: entries.length,
  };
  return ok(body, {
    cacheControl: "public, s-maxage=600, stale-while-revalidate=3600",
    request,
  });
}
