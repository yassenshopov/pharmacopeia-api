import { ok } from "@/lib/api/response";
import { getRepository, getRepositoryKind } from "@/lib/data/repository";
import type { HealthResponse } from "@/lib/schemas";

/**
 * GET /api/v1/health
 *
 * Liveness + dataset-version probe. Designed to be cheap enough to poll
 * from uptime monitors and load balancers — no real payload to parse,
 * just the snapshot version and current wall-clock time. Cached for one
 * minute at the CDN so a flood of pings can't stampede the origin.
 *
 * Also surfaces deployment metadata when the host platform provides it
 * (Vercel sets VERCEL_GIT_COMMIT_SHA and VERCEL_REGION at build/runtime)
 * and which repository backend is currently serving — `"static"` for
 * the seed fallback, `"supabase"` when DATABASE_URL is configured.
 */
export async function GET(request: Request) {
  const stats = await getRepository().getStats();

  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.GIT_COMMIT_SHA?.slice(0, 7);
  const region = process.env.VERCEL_REGION;

  const body: HealthResponse = {
    status: "ok",
    version: stats.version,
    updatedAt: stats.updatedAt,
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    repository: getRepositoryKind(),
    ...(commit ? { commit } : {}),
    ...(region ? { region } : {}),
  };
  return ok(body, { cacheControl: "public, s-maxage=60", request });
}
