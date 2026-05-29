import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { DrugShortagesResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/shortages
 *
 * Per-drug FDA shortage status. Returns every reported presentation
 * (strength × dosage form) currently on the openFDA shortages list,
 * including resolved and discontinuation entries. `anyActive` is a
 * cheap roll-up so a caller can render a badge without scanning the
 * list.
 *
 * Reference statistics only — FDA shortage status changes frequently.
 * For a live view, see https://www.accessdata.fda.gov/scripts/drugshortages/
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const entries = await repo.getDrugShortages(slug);
  const body: DrugShortagesResponse = {
    drug: { slug: drug.slug, name: drug.name },
    entries,
    anyActive: entries.some((e) => e.status === "active"),
    total: entries.length,
  };
  // Shortage status changes often — shorter CDN TTL than the default.
  return ok(body, {
    cacheControl: "public, s-maxage=600, stale-while-revalidate=3600",
    request,
  });
}
