/**
 * POST/GET /api/cron/refresh-shortages
 *
 * Scheduled ingest (Vercel cron, see vercel.json): re-pulls the openFDA
 * drug-shortage dataset and replaces the `shortages` table, joining
 * rows onto drugs by the same crosswalk logic the seed pipeline uses
 * (shared via lib/ingest/shortages.ts — never duplicated).
 *
 * Delta-aware: a content hash over the rebuilt dataset (excluding
 * `extractedAt`) is compared against the rows currently in Postgres;
 * when upstream hasn't changed the table is left untouched, so an
 * unchanged upstream costs one read and zero writes.
 *
 * Auth: Vercel cron invokes this with `Authorization: Bearer <CRON_SECRET>`.
 * Manual triggers must present the same header. Without CRON_SECRET set
 * the route refuses to run rather than being silently public.
 *
 * This is an internal operational route — it is intentionally not part
 * of the public /api/v1 surface, the SDK manifest, or the OpenAPI spec.
 */

import { requireCron } from "@/lib/api/cron";
import { getPrismaClient } from "@/lib/db/client";
import type { ShortageEntry } from "@/lib/schemas";
import {
  buildShortageCrosswalk,
  buildShortageEntries,
  fetchAllShortageRecords,
  shortageDatasetHash,
} from "@/lib/ingest/shortages";
import { submitToIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WRITE_BATCH = 200;

async function refresh(request: Request): Promise<Response> {
  const gate = requireCron(request);
  if (gate) return gate;

  const startedAt = Date.now();
  const db = getPrismaClient();

  // Crosswalk straight from Postgres: drug name + every component
  // ingredient name → slug. Slim selects only; payloads stay on disk.
  const [drugs, ingredients] = await Promise.all([
    db.drug.findMany({ select: { slug: true, name: true, ingredientSlugs: true } }),
    db.ingredient.findMany({ select: { slug: true, name: true } }),
  ]);
  const ingredientName = new Map(ingredients.map((i) => [i.slug, i.name]));
  const crosswalk = buildShortageCrosswalk(
    drugs.map((d) => ({
      slug: d.slug,
      names: [
        d.name,
        ...d.ingredientSlugs
          .map((s) => ingredientName.get(s))
          .filter((n): n is string => Boolean(n)),
      ],
    })),
  );

  const records = await fetchAllShortageRecords();
  const extractedAt = new Date().toISOString();
  const { bySlug, total, unmatched, unknownStatus } = buildShortageEntries(
    records,
    crosswalk,
    extractedAt,
  );

  // Hash the rebuilt dataset against what's already in the table.
  const existingRows = await db.shortage.findMany({
    orderBy: { id: "asc" },
  });
  const existingBySlug = new Map<string, ShortageEntry[]>();
  for (const row of existingRows) {
    const entry = row.payload as unknown as ShortageEntry;
    const arr = existingBySlug.get(row.drugSlug) ?? [];
    arr.push(entry);
    existingBySlug.set(row.drugSlug, arr);
  }
  const nextHash = shortageDatasetHash(bySlug);
  const priorHash = shortageDatasetHash(existingBySlug);

  const summary = {
    upstreamRows: records.length,
    entries: total,
    drugsMatched: bySlug.size,
    skipped: { unmatched, unknownStatus },
    tookMs: Date.now() - startedAt,
  };

  if (nextHash === priorHash) {
    return Response.json({ data: { changed: false, ...summary } });
  }

  const rows = [...bySlug.values()].flat().map((entry) => ({
    drugSlug: entry.drug,
    payload: JSON.parse(JSON.stringify(entry)),
  }));
  await db.$transaction(async (tx) => {
    await tx.shortage.deleteMany();
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      await tx.shortage.createMany({ data: rows.slice(i, i + WRITE_BATCH) });
    }
  });

  // Best-effort: nudge IndexNow for the drug pages whose shortage status
  // changed, plus the shortage index. Never blocks or fails the refresh.
  const indexNow = await submitToIndexNow([
    "/shortages",
    ...[...bySlug.keys()].map((slug) => `/drugs/${slug}`),
  ]);

  return Response.json({
    data: {
      changed: true,
      ...summary,
      indexNow,
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
