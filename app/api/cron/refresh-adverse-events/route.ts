/**
 * POST/GET /api/cron/refresh-adverse-events
 *
 * Rotating FAERS refresh (Vercel cron, see vercel.json). openFDA rate
 * limits make refreshing 5,000+ drugs in one run impossible, so each
 * invocation processes the next window of drugs in slug order (cursor
 * persisted in cron_state, wrapping at the end) and the whole dataset
 * cycles continuously without any single run being heavy.
 *
 * Delta-aware per drug: the rebuilt aggregate's provenance.sourceHash
 * covers counts (not timestamps), so an unchanged upstream row is
 * detected and skipped without a write. Drugs openFDA has no reports
 * for are simply skipped — an existing aggregate is never deleted on a
 * transient miss.
 *
 * Tunables (env):
 *   FAERS_CRON_BATCH  drugs per invocation (default 100, max 500)
 *   OPENFDA_API_KEY   strongly recommended; unkeyed cap is 1,000 req/day
 *                     and each drug costs two requests
 *
 * Internal operational route — not part of /api/v1, the SDK manifest,
 * or the OpenAPI document.
 */

import { requireCron } from "@/lib/api/cron";
import { getPrismaClient } from "@/lib/db/client";
import { fetchAdverseEventStats } from "@/lib/ingest/adverse-events";
import type { AdverseEventStats } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_ID = "refresh-adverse-events";
const TOP_N = 25;
const THROTTLE_MS = 150;

function batchSize(): number {
  const raw = Number.parseInt(process.env.FAERS_CRON_BATCH ?? "100", 10);
  if (!Number.isFinite(raw)) return 100;
  return Math.min(Math.max(raw, 1), 500);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function refresh(request: Request): Promise<Response> {
  const gate = requireCron(request);
  if (gate) return gate;

  const startedAt = Date.now();
  const db = getPrismaClient();
  const take = batchSize();

  // Resume after the cursor, wrapping to the start when the tail is
  // shorter than one window. Slug order is stable, so every drug is
  // visited exactly once per cycle even as records are added.
  const state = await db.cronState.findUnique({ where: { id: CRON_ID } });
  const afterSlug =
    (state?.payload as { afterSlug?: string } | null)?.afterSlug ?? "";

  let batch = await db.drug.findMany({
    where: { slug: { gt: afterSlug } },
    orderBy: { slug: "asc" },
    take,
    select: { slug: true, name: true },
  });
  let wrapped = false;
  if (batch.length < take) {
    wrapped = true;
    const fill = await db.drug.findMany({
      orderBy: { slug: "asc" },
      take: take - batch.length,
      select: { slug: true, name: true },
    });
    const seen = new Set(batch.map((d) => d.slug));
    batch = [...batch, ...fill.filter((d) => !seen.has(d.slug))];
  }

  if (batch.length === 0) {
    return Response.json({
      data: { processed: 0, note: "no drugs in database" },
    });
  }

  const existingRows = await db.adverseEvents.findMany({
    where: { drugSlug: { in: batch.map((d) => d.slug) } },
  });
  const existingBySlug = new Map(
    existingRows.map((r) => [
      r.drugSlug,
      r.payload as unknown as AdverseEventStats,
    ]),
  );

  const extractedAt = new Date().toISOString();
  const apiKey = process.env.OPENFDA_API_KEY;
  let updated = 0;
  let unchanged = 0;
  let noData = 0;

  for (const drug of batch) {
    const stats = await fetchAdverseEventStats(drug.slug, drug.name, {
      topN: TOP_N,
      extractedAt,
      apiKey,
    });
    if (!stats) {
      noData++;
    } else if (
      existingBySlug.get(drug.slug)?.provenance.sourceHash ===
      stats.provenance.sourceHash
    ) {
      unchanged++;
    } else {
      await db.adverseEvents.upsert({
        where: { drugSlug: drug.slug },
        create: {
          drugSlug: drug.slug,
          payload: JSON.parse(JSON.stringify(stats)),
        },
        update: { payload: JSON.parse(JSON.stringify(stats)) },
      });
      updated++;
    }
    await sleep(THROTTLE_MS);
  }

  const nextCursor = batch[batch.length - 1].slug;
  await db.cronState.upsert({
    where: { id: CRON_ID },
    create: { id: CRON_ID, payload: { afterSlug: nextCursor } },
    update: { payload: { afterSlug: nextCursor } },
  });

  return Response.json({
    data: {
      processed: batch.length,
      updated,
      unchanged,
      noData,
      wrapped,
      cursor: nextCursor,
      tookMs: Date.now() - startedAt,
    },
  });
}

// Vercel cron sends GET; POST kept for manual/CI triggers.
export async function GET(request: Request): Promise<Response> {
  return refresh(request);
}

export async function POST(request: Request): Promise<Response> {
  return refresh(request);
}
