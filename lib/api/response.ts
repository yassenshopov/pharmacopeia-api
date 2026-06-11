import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/schemas";

/**
 * Consistent JSON responses for every v1 route. We always set
 * cache headers so Vercel's edge handles repeat traffic for free,
 * an `X-Robots-Tag` so search engines never index our JSON payloads
 * as web pages, and a strong `ETag` so well-behaved clients and the
 * CDN can revalidate with a tiny `If-None-Match` round trip instead
 * of refetching the full body.
 */

const DEFAULT_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const NOINDEX = "noindex, nofollow";

/**
 * Strong ETag over the serialised body. SHA-1 is fine here — this is a
 * cache key, not a security primitive — and is short enough to keep
 * headers small. Truncated to 16 hex chars (64 bits of entropy) so
 * accidental collisions across versions of a single endpoint are
 * effectively impossible while keeping the header tight.
 */
function computeEtag(body: string): string {
  const digest = createHash("sha1").update(body).digest("hex").slice(0, 16);
  return `"${digest}"`;
}

/**
 * RFC 9110 `If-None-Match` matching: comma-separated list of ETags, or
 * `*` matching any current representation. We never emit weak tags, so
 * we don't bother stripping the `W/` prefix on inbound values either.
 */
function ifNoneMatchHits(ifNoneMatch: string, etag: string): boolean {
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch
    .split(",")
    .some((candidate) => candidate.trim() === etag);
}

export function ok<T>(
  data: T,
  init?: {
    cacheControl?: string;
    status?: number;
    /** Pass the incoming request to enable 304 Not Modified short-circuiting. */
    request?: Request;
  },
): NextResponse {
  const body = JSON.stringify(data);
  const etag = computeEtag(body);
  const cacheControl = init?.cacheControl ?? DEFAULT_CACHE;

  const ifNoneMatch = init?.request?.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatchHits(ifNoneMatch, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": cacheControl,
        ETag: etag,
        Vary: "Accept-Encoding",
        "X-Robots-Tag": NOINDEX,
      },
    });
  }

  return new NextResponse(body, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      Vary: "Accept-Encoding",
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

export function unauthorized(
  message = "A valid API key is required. Pass it as 'Authorization: Bearer <key>'.",
): NextResponse {
  const body: ApiError = {
    error: { code: "unauthorized", message },
  };
  return NextResponse.json(body, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Bearer realm="pharmacopeia"',
      "X-Robots-Tag": NOINDEX,
    },
  });
}

export function notConfigured(message: string): NextResponse {
  const body: ApiError = {
    error: { code: "not_configured", message },
  };
  return NextResponse.json(body, {
    status: 503,
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
