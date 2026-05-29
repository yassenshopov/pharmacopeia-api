/**
 * scripts/ingest/fetch-adverse-events.ts
 *
 * Pulls aggregate FAERS (FDA Adverse Event Reporting System) counts
 * from openFDA for every drug in the dataset and writes the result to
 * `lib/data/seed/adverse-events.ts`.
 *
 * For each drug we issue two openFDA queries:
 *
 *   /drug/event.json?search=patient.drug.openfda.generic_name:"<name>"
 *     ?count=patient.reaction.reactionmeddrapt.exact&limit=25
 *
 *   /drug/event.json?search=patient.drug.openfda.generic_name:"<name>"
 *     &limit=1   (to read `meta.results.total`)
 *
 * The result is rounded to the top-N reactions per drug, stamped with
 * provenance, and serialised to disk.
 *
 * **Framing matters here.** Every record carries an inline disclaimer
 * field that travels with the data so downstream consumers can never
 * accidentally interpret these counts as incidence rates or signals.
 *
 * Tunables (env):
 *   FAERS_TOP_N       max reactions stored per drug (default 25, max 100)
 *   FAERS_THROTTLE_MS delay between requests          (default 100)
 *   FAERS_MAX_DRUGS   debug cap on drug count         (default Infinity)
 *
 * Run: npm run ingest:adverse-events
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AdverseEventStatsSchema,
  ADVERSE_EVENT_DISCLAIMER,
  type AdverseEventReport,
  type AdverseEventStats,
  type Provenance,
} from "../../lib/schemas";
import { SEED_DRUGS } from "../../lib/data/seed/drugs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_FILE = resolve(REPO_ROOT, "lib/data/seed/adverse-events.ts");

const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

const TOP_N = clampInt(process.env.FAERS_TOP_N, 25, 1, 100);
const THROTTLE_MS = clampInt(process.env.FAERS_THROTTLE_MS, 100, 0, 5000);
const MAX_DRUGS = clampInt(process.env.FAERS_MAX_DRUGS, Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER);

function clampInt(
  raw: string | undefined,
  fallback: number,
  lo: number,
  hi: number,
): number {
  const n = raw == null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), lo), hi);
}

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

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

function titleCaseReaction(term: string): string {
  return term
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function fdaSearch(genericName: string): string {
  // openFDA wants `field:"value"`. Lowercase and double-quote to match
  // the indexed form. Some names have apostrophes or commas which need
  // to be escaped inside the quoted string.
  const escaped = genericName
    .toLowerCase()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `patient.drug.openfda.generic_name:"${escaped}"`;
}

function buildCountUrl(genericName: string): string {
  const search = encodeURIComponent(fdaSearch(genericName));
  const count = encodeURIComponent("patient.reaction.reactionmeddrapt.exact");
  return `https://api.fda.gov/drug/event.json?search=${search}&count=${count}&limit=${TOP_N}`;
}

function buildTotalUrl(genericName: string): string {
  const search = encodeURIComponent(fdaSearch(genericName));
  return `https://api.fda.gov/drug/event.json?search=${search}&limit=1`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null; // openFDA's no-results signal.
  if (!res.ok) {
    process.stderr.write(`  ! HTTP ${res.status} on ${url}\n`);
    return null;
  }
  return (await res.json()) as T;
}

function toIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^\d{8}$/.test(raw)) {
    // openFDA returns YYYYMMDD in `receivedate` etc.
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return undefined;
}

async function fetchOne(drugSlug: string, genericName: string): Promise<AdverseEventStats | null> {
  const countUrl = buildCountUrl(genericName);
  const totalUrl = buildTotalUrl(genericName);

  const [countPayload, totalPayload] = await Promise.all([
    fetchJson<CountResponse>(countUrl),
    fetchJson<MetaResponse>(totalUrl),
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
    extractedAt: EXTRACTED_AT,
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

function emitSeed(map: Map<string, AdverseEventStats>): string {
  const slugs = [...map.keys()].sort();
  const blocks = slugs.map((slug) => {
    const s = map.get(slug)!;
    const reactions = s.topReactions
      .map(
        (r) =>
          `      { reaction: ${JSON.stringify(r.reaction)}, count: ${r.count} },`,
      )
      .join("\n");
    const lines = [
      `  ${JSON.stringify(slug)}: {`,
      `    drug: ${JSON.stringify(s.drug)},`,
      `    totalReports: ${s.totalReports},`,
      `    topReactions: [`,
      reactions,
      `    ],`,
    ];
    if (s.windowStart) lines.push(`    windowStart: ${JSON.stringify(s.windowStart)},`);
    if (s.windowEnd) lines.push(`    windowEnd: ${JSON.stringify(s.windowEnd)},`);
    lines.push(`    disclaimer: ${JSON.stringify(s.disclaimer)},`);
    lines.push(`    provenance: {`);
    lines.push(`      sourceUrl: ${JSON.stringify(s.provenance.sourceUrl)},`);
    lines.push(`      sourceHash: ${JSON.stringify(s.provenance.sourceHash)},`);
    lines.push(`      extractedAt: ${JSON.stringify(s.provenance.extractedAt)},`);
    lines.push(`      extractor: ${JSON.stringify(s.provenance.extractor)},`);
    lines.push(`      confidence: ${s.provenance.confidence},`);
    lines.push(`    },`);
    lines.push(`  },`);
    return lines.join("\n");
  });

  return `// AUTO-GENERATED by scripts/ingest/fetch-adverse-events.ts
// Source: openFDA drug/event (FAERS) — see provenance.sourceUrl on each entry.
// Do not edit by hand; re-run \`npm run ingest:adverse-events\` to refresh.
//
// FAERS reports are voluntarily submitted and are NOT incidence rates,
// signals, or causal evidence. Counts reflect reporting volume, not
// how often a reaction occurs. Reference statistics only.
//
// For decision-grade use, consult openFDA / the FAERS Public Dashboard
// directly: https://open.fda.gov/data/faers/

import type { AdverseEventStats } from "@/lib/schemas";

/**
 * Aggregate FAERS counts keyed by drug slug.
 */
export const SEED_ADVERSE_EVENTS: Record<string, AdverseEventStats> = {
${blocks.join("\n")}
};

export function getSeedAdverseEvents(slug: string): AdverseEventStats | null {
  return SEED_ADVERSE_EVENTS[slug] ?? null;
}
`;
}

async function main(): Promise<void> {
  const drugs = SEED_DRUGS.slice(0, MAX_DRUGS);
  process.stderr.write(
    `[fetch-adverse-events] processing ${drugs.length} drugs ` +
      `(topN=${TOP_N}, throttle=${THROTTLE_MS}ms)\n`,
  );

  const out = new Map<string, AdverseEventStats>();
  let withData = 0;
  let withoutData = 0;

  for (const drug of drugs) {
    const stats = await fetchOne(drug.slug, drug.name);
    if (stats) {
      out.set(drug.slug, stats);
      withData += 1;
    } else {
      withoutData += 1;
    }
    process.stderr.write(
      `  ${drug.slug}: ${stats ? `${stats.totalReports} reports / ${stats.topReactions.length} top reactions` : "no data"}\n`,
    );
    await sleep(THROTTLE_MS);
  }

  const text = emitSeed(out);
  writeFileSync(OUT_FILE, text, "utf8");
  process.stderr.write(
    `[fetch-adverse-events] wrote ${OUT_FILE} ` +
      `(${withData} with data, ${withoutData} without)\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[fetch-adverse-events] FAILED: ${msg}\n`);
  process.exit(1);
});
