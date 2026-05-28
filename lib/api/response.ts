import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/schemas";

/**
 * Consistent JSON responses for every v1 route. We always set
 * cache headers so Vercel's edge handles repeat traffic for free,
 * and an `X-Robots-Tag` so search engines never index our JSON
 * payloads as web pages.
 */

const DEFAULT_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const NOINDEX = "noindex, nofollow";

export function ok<T>(
  data: T,
  init?: { cacheControl?: string; status?: number },
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": init?.cacheControl ?? DEFAULT_CACHE,
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": NOINDEX,
    },
  });
}

export function notFound(message = "Not found"): NextResponse {
  const body: ApiError = {
    error: { code: "not_found", message },
  };
  return NextResponse.json(body, {
    status: 404,
    headers: {
      "Cache-Control": "public, s-maxage=60",
      "X-Robots-Tag": NOINDEX,
    },
  });
}

export function invalid(
  message = "Invalid request",
  details?: unknown,
): NextResponse {
  const body: ApiError = {
    error: { code: "invalid_request", message, details },
  };
  return NextResponse.json(body, {
    status: 400,
    headers: { "X-Robots-Tag": NOINDEX },
  });
}

export function serverError(message = "Internal error"): NextResponse {
  const body: ApiError = {
    error: { code: "internal_error", message },
  };
  return NextResponse.json(body, {
    status: 500,
    headers: { "X-Robots-Tag": NOINDEX },
  });
}

export function parseLimitOffset(url: URL): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const offset = Math.max(
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );
  return { limit, offset };
}
