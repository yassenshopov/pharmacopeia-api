import { createHash } from "node:crypto";
import { getRepositoryKind } from "@/lib/data/repository";
import { getPrismaClient } from "@/lib/db/client";
import { defaultRateLimitPerMinute, utcDay } from "./rate-limit";

/**
 * API-key authentication for the paid/grounded tier and webhook
 * management.
 *
 * Keys are `pk_live_...` strings minted by `npm run keys:create`; only
 * the sha256 of a key is stored (api_keys.key_hash), so a database leak
 * never leaks usable credentials. For local dev and the static-seed
 * deployment, `PHARMACOPEIA_API_KEYS` (comma-separated plaintext keys)
 * accepts keys without a database — those authenticate but carry no
 * usage counters and own no webhook endpoints (api_key_id NULL).
 */

export interface AuthenticatedKey {
  tier: string;
  /** ApiKey row id for db-backed keys; null for env-var keys. */
  keyId: string | null;
  /** Lifetime request count after this call (db-backed keys only). */
  requestCount?: number;
  /**
   * Stable bucket id for the in-memory rate limiter: the row id for
   * db-backed keys, the key's sha256 for env-var keys. Never the
   * plaintext key.
   */
  rateLimitBucket: string;
  /** Requests/minute allowed; from the row or the env default. */
  rateLimitPerMinute: number;
  /** Requests/UTC-day allowed (db-backed keys only). */
  dailyQuota?: number;
  /** Requests counted against today's quota, including this one. */
  quotaUsedToday?: number;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** `Authorization: Bearer <key>`, with `X-API-Key` as a fallback. */
export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const key = auth.slice("bearer ".length).trim();
    if (key) return key;
  }
  const headerKey = request.headers.get("x-api-key")?.trim();
  return headerKey || null;
}

function envKeys(): string[] {
  return (process.env.PHARMACOPEIA_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Authenticate the request's API key. Returns null when no key is
 * presented or the key is unknown/revoked. Db-backed keys get their
 * `lastUsedAt` / `requestCount` bumped as a side effect.
 */
export async function authenticateApiKey(
  request: Request,
): Promise<AuthenticatedKey | null> {
  const key = extractApiKey(request);
  if (!key) return null;

  if (envKeys().includes(key)) {
    return {
      tier: "grounded",
      keyId: null,
      rateLimitBucket: hashApiKey(key),
      rateLimitPerMinute: defaultRateLimitPerMinute(),
    };
  }

  if (getRepositoryKind() !== "supabase") return null;

  const db = getPrismaClient();
  const row = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
  });
  if (!row || row.revokedAt) return null;

  // Roll the quota counter over at UTC midnight. The read-then-update
  // race at the rollover boundary can drop a count or two — acceptable
  // for fair-use quotas, not worth a raw upsert.
  const today = utcDay();
  const updated = await db.apiKey.update({
    where: { id: row.id },
    data: {
      lastUsedAt: new Date(),
      requestCount: { increment: 1 },
      ...(row.quotaDay === today
        ? { quotaUsed: { increment: 1 } }
        : { quotaDay: today, quotaUsed: 1 }),
    },
    select: { requestCount: true, quotaUsed: true },
  });
  return {
    tier: row.tier,
    keyId: row.id,
    requestCount: updated.requestCount,
    rateLimitBucket: row.id,
    rateLimitPerMinute: row.rateLimitPerMinute,
    dailyQuota: row.dailyQuota,
    quotaUsedToday: updated.quotaUsed,
  };
}
