/**
 * Per-key rate limiting and daily quotas for the key-gated tier.
 *
 * Two layers, enforced together by `lib/auth/guard.ts`:
 *
 *  - **Per-minute rate limit** — fixed 60-second window counted
 *    in-memory. On serverless this is per-instance, so it is a
 *    best-effort fair-use brake, not a billing meter. The limit comes
 *    from `api_keys.rate_limit_per_minute` for db-backed keys and
 *    `PHARMACOPEIA_RATE_LIMIT_PER_MINUTE` (default 60) for env-var keys.
 *  - **Daily quota** — counted in Postgres (`quota_day` / `quota_used`
 *    on the key row), so it is precise across instances and deploys.
 *    Env-var keys carry no quota: they exist for zero-db deployments
 *    where there is nowhere durable to count.
 *
 * Both surfaces report through standard headers: `X-RateLimit-Limit`,
 * `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds) for the
 * minute window, `X-Quota-Limit` / `X-Quota-Remaining` for the day, and
 * `Retry-After` on 429s.
 */

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch seconds when the current window resets. */
  resetAt: number;
}

interface WindowEntry {
  windowStart: number;
  count: number;
}

const WINDOW_MS = 60_000;

const windows = new Map<string, WindowEntry>();

/** Drop stale windows so the map can't grow unbounded across keys. */
function prune(now: number): void {
  if (windows.size < 10_000) return;
  for (const [key, entry] of windows) {
    if (now - entry.windowStart >= WINDOW_MS) windows.delete(key);
  }
}

export function defaultRateLimitPerMinute(): number {
  const raw = Number.parseInt(
    process.env.PHARMACOPEIA_RATE_LIMIT_PER_MINUTE ?? "",
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

/**
 * Count one request against the key's fixed one-minute window.
 * `bucket` must be stable per key but never the plaintext key itself —
 * callers pass the db key id or the sha256 of an env-var key.
 */
export function checkRateLimit(
  bucket: string,
  limit: number,
): RateLimitDecision {
  const now = Date.now();
  prune(now);

  let entry = windows.get(bucket);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    windows.set(bucket, entry);
  }
  entry.count += 1;

  const resetAt = Math.ceil((entry.windowStart + WINDOW_MS) / 1000);
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(limit - entry.count, 0),
    resetAt,
  };
}

/** Reset all in-memory windows. Exported for tests only. */
export function resetRateLimitWindows(): void {
  windows.clear();
}

export interface QuotaDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
}

/** UTC day key (YYYY-MM-DD) the quota counters are bucketed by. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function decideQuota(
  dailyQuota: number,
  quotaUsedToday: number,
): QuotaDecision {
  return {
    allowed: quotaUsedToday <= dailyQuota,
    limit: dailyQuota,
    remaining: Math.max(dailyQuota - quotaUsedToday, 0),
  };
}

/** Seconds until the next UTC midnight — `Retry-After` for quota 429s. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(Math.ceil((next - now.getTime()) / 1000), 1);
}
