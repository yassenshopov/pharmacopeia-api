import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { AdverseEventStatsResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/adverse-events
 *
 * Aggregate FAERS (FDA Adverse Event Reporting System) report counts
 * for a single drug. Returns the top reactions by reporting volume,
 * plus the total number of matched reports and the window the snapshot
 * covers.
 *
 * **Reference statistics only.** FAERS reports are voluntarily
 * submitted; the counts here are reporting volume, NOT incidence
 * rates, NOT signals, NOT causality. The `disclaimer` field on the
 * payload travels inline so any downstream consumer (JSON, SDK, MCP,
 * AI agent) sees the caveat next to the numbers.
 *
 * When no snapshot has been ingested for the drug, `stats` is `null`
 * — empty results are NOT the same as zero reports.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const stats = await repo.getAdverseEventStats(slug);
  const body: AdverseEventStatsResponse = {
    drug: { slug: drug.slug, name: drug.name },
    stats,
  };
  return ok(body, { request });
}
