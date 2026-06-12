/**
 * lib/ingest/adverse-events.ts
 *
 * Shared openFDA FAERS aggregate logic, consumed by both:
 *   - scripts/ingest/fetch-adverse-events.ts  (writes the TS seed file)
 *   - app/api/cron/refresh-adverse-events     (rotating Postgres refresh)
 *
 * Per AGENTS.md, per-record pipeline logic is never duplicated between
 * pipelines. Everything here is per-drug: query building, escaping,
 * response shaping, hashing, and the disclaimer that always travels
 * with the data.
 *
 * FAERS reports are voluntarily submitted and are NOT incidence rates,
 * signals, or causal evidence — every record carries an inline
 * disclaimer so downstream consumers can't lose the framing.
 */

import { createHash } from "node:crypto";

import {
  AdverseEventStatsSchema,
  ADVERSE_EVENT_DISCLAIMER,
  type AdverseEventReport,
  type AdverseEventStats,
  type Provenance,
} from "@/lib/schemas";

interface CountTermBucket {
  term: string;
  count: number;
}

interface CountResponse {
  results?: CountTermBucket[];
  error?: { code?: string; message?: string };
}

interface MetaResponse {
  meta?: { results?: { total?: number } };
  results?: Array<{
    receivedate?: string;
    receiptdate?: string;
  }>;
  error?: { code?: string; message?: string };
}

export function titleCaseReaction(term: string): string {
  return term
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function fdaSearch(genericName: string): string {
  // openFDA wants `field:"value"`. Lowercase and double-quote to match
  // the indexed form. Some names have apostrophes or commas which need
  // to be escaped inside the quoted string.
  const escaped = genericName
    .toLowerCase()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `patient.drug.openfda.generic_name:"${escaped}"`;
}

function withApiKey(url: string, apiKey: string | undefined): string {
  return apiKey ? `${url}&api_key=${encodeURIComponent(apiKey)}` : url;
}

export function buildCountUrl(
  genericName: string,
  topN: number,
  apiKey?: string,
): string {
  const search = encodeURIComponent(fdaSearch(genericName));
  const count = encodeURIComponent("patient.reaction.reactionmeddrapt.exact");
  return withApiKey(
    `https://api.fda.gov/drug/event.json?search=${search}&count=${count}&limit=${topN}`,
    apiKey,
  );
}

export function buildTotalUrl(genericName: string, apiKey?: string): string {
  const search = encodeURIComponent(fdaSearch(genericName));
  return withApiKey(
    `https://api.fda.gov/drug/event.json?search=${search}&limit=1`,
    apiKey,
  );
}

async function fetchJson<T>(
  url: string,
  log: (line: string) => void,
): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null; // openFDA's no-results signal.
  if (!res.ok) {
    log(`HTTP ${res.status} on ${url}`);
    return null;
  }
  return (await res.json()) as T;
}

export function toIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^\d{8}$/.test(raw)) {
    // openFDA returns YYYYMMDD in `receivedate` etc.
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return undefined;
}

export interface FetchAdverseEventsOptions {
  /** Max reactions stored per drug. */
  topN: number;
  /** Provenance timestamp (deterministic for the seed, now() for cron). */
  extractedAt: string;
  /** openFDA API key; without one api.fda.gov caps at 1,000 req/day. */
  apiKey?: string;
  log?: (line: string) => void;
}

/**
 * Fetch and shape one drug's FAERS aggregate. Returns null when openFDA
 * has no reports for the name (which is common in the long tail).
 * The provenance sourceHash covers the counts, not the timestamp, so
 * unchanged upstream data hashes identically across runs.
 */
export async function fetchAdverseEventStats(
  drugSlug: string,
  genericName: string,
  opts: FetchAdverseEventsOptions,
): Promise<AdverseEventStats | null> {
  const log = opts.log ?? (() => {});
  // The hashed/provenance URL never includes the API key.
  const countUrl = buildCountUrl(genericName, opts.topN);

  const [countPayload, totalPayload] = await Promise.all([
    fetchJson<CountResponse>(
      buildCountUrl(genericName, opts.topN, opts.apiKey),
      log,
    ),
    fetchJson<MetaResponse>(buildTotalUrl(genericName, opts.apiKey), log),
  ]);

  if (!countPayload?.results || countPayload.results.length === 0) {
    return null;
  }

  const topReactions: AdverseEventReport[] = countPayload.results
    .filter((r) => r.term && Number.isFinite(r.count) && r.count > 0)
    .map((r) => ({
      reaction: titleCaseReaction(r.term),
      count: r.count,
    }));

  if (topReactions.length === 0) return null;

  const totalReports = totalPayload?.meta?.results?.total ?? 0;
  const sampleDate =
    toIsoDate(totalPayload?.results?.[0]?.receivedate) ??
    toIsoDate(totalPayload?.results?.[0]?.receiptdate);

  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        url: countUrl,
        total: totalReports,
        top: topReactions,
      }),
    )
    .digest("hex");

  const provenance: Provenance = {
    sourceUrl: countUrl,
    sourceHash,
    extractedAt: opts.extractedAt,
    extractor: "openfda-faers",
    confidence: 0.85,
  };

  const stats: AdverseEventStats = {
    drug: drugSlug,
    totalReports,
    topReactions,
    ...(sampleDate ? { windowEnd: sampleDate } : {}),
    disclaimer: ADVERSE_EVENT_DISCLAIMER,
    provenance,
  };

  AdverseEventStatsSchema.parse(stats);
  return stats;
}
