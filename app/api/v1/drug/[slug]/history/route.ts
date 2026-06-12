import { invalid, notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { DrugHistoryResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/history
 *
 * Dataset time-travel for one drug. Returns the current snapshot's
 * provenance (the newest known state) plus the change-event timeline for
 * the drug, newest first — the same feed that powers `/changelog`,
 * filtered to this entity. No separate version store: this leans on the
 * `extractedAt` provenance stamp and the changelog the dataset already
 * maintains.
 *
 * Pin `?asOf=<ISO-8601>` to trim the timeline to events at or before
 * that instant; the requested instant is echoed back in `asOf`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const url = new URL(request.url);
  const asOfParam = url.searchParams.get("asOf");
  let asOfMs: number | null = null;
  if (asOfParam !== null) {
    asOfMs = Date.parse(asOfParam);
    if (Number.isNaN(asOfMs)) {
      return invalid("Query parameter 'asOf' must be an ISO-8601 timestamp");
    }
  }

  let events = await repo.getDrugChangeHistory(slug);
  if (asOfMs !== null) {
    events = events.filter((e) => Date.parse(e.timestamp) <= asOfMs);
  }

  const body: DrugHistoryResponse = {
    drug: { slug: drug.slug, name: drug.name },
    provenance: drug.provenance,
    ...(asOfParam !== null
      ? { asOf: new Date(asOfMs as number).toISOString() }
      : {}),
    events,
    total: events.length,
  };
  return ok(body, { request });
}
