import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { HealthResponse } from "@/lib/schemas";

/**
 * GET /api/v1/health
 *
 * Liveness + dataset-version probe. Designed to be cheap enough to poll
 * from uptime monitors and load balancers — no real payload to parse,
 * just the snapshot version and current wall-clock time. Cached for one
 * minute at the CDN so a flood of pings can't stampede the origin.
 */
export async function GET(request: Request) {
  const stats = await getRepository().getStats();
  const body: HealthResponse = {
    status: "ok",
    version: stats.version,
    updatedAt: stats.updatedAt,
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
  return ok(body, { cacheControl: "public, s-maxage=60", request });
}
