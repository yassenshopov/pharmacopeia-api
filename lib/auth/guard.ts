import type { NextResponse } from "next/server";
import { rateLimited, unauthorized } from "@/lib/api/response";
import {
  authenticateApiKey,
  type AuthenticatedKey,
} from "@/lib/auth/api-keys";
import {
  checkRateLimit,
  decideQuota,
  secondsUntilUtcMidnight,
} from "@/lib/auth/rate-limit";

/**
 * One call per gated route: authenticate the key, count the request
 * against its per-minute window and daily quota, and either hand back
 * the auth context plus the rate-limit headers to attach to the
 * success response, or the finished 401/429 to return as-is.
 */
export type GuardResult =
  | { ok: true; auth: AuthenticatedKey; headers: Record<string, string> }
  | { ok: false; response: NextResponse };

export async function guardApiKey(request: Request): Promise<GuardResult> {
  const auth = await authenticateApiKey(request);
  if (!auth) return { ok: false, response: unauthorized() };

  const minute = checkRateLimit(auth.rateLimitBucket, auth.rateLimitPerMinute);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(minute.limit),
    "X-RateLimit-Remaining": String(minute.remaining),
    "X-RateLimit-Reset": String(minute.resetAt),
  };

  if (auth.dailyQuota !== undefined && auth.quotaUsedToday !== undefined) {
    const quota = decideQuota(auth.dailyQuota, auth.quotaUsedToday);
    headers["X-Quota-Limit"] = String(quota.limit);
    headers["X-Quota-Remaining"] = String(quota.remaining);
    if (!quota.allowed) {
      return {
        ok: false,
        response: rateLimited(
          `Daily quota of ${quota.limit} requests exhausted; resets at UTC midnight`,
          { retryAfterSeconds: secondsUntilUtcMidnight(), headers },
        ),
      };
    }
  }

  if (!minute.allowed) {
    const retryAfter = Math.max(
      minute.resetAt - Math.floor(Date.now() / 1000),
      1,
    );
    return {
      ok: false,
      response: rateLimited(
        `Rate limit of ${minute.limit} requests/minute exceeded`,
        { retryAfterSeconds: retryAfter, headers },
      ),
    };
  }

  return { ok: true, auth, headers };
}

/** Attach the guard's rate-limit headers to a route's success response. */
export function withRateLimitHeaders(
  response: NextResponse,
  headers: Record<string, string>,
): NextResponse {
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}
