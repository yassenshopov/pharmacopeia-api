/**
 * scripts/ingest/fetch-trials.ts
 *
 * Crosswalks every drug in the dataset to its registered studies on
 * ClinicalTrials.gov via the v2 API. Results are written to
 * `lib/data/seed/trials.ts`.
 *
 * Strategy:
 *  - `query.intr=<name>` so a study must list the drug as an
 *    intervention — a mention in the abstract is not enough.
 *  - Sort by `LastUpdatePostDate:desc` so the sample is the freshest
 *    slice of the registry, and keep the registry's `totalCount` so
 *    consumers see the size of the full match space.
 *  - Cap at TRIALS_TOP_N studies per drug.
 *
 * Idempotent: deterministic provenance.extractedAt, sorted output,
 * stable hashing. Re-runs against an unchanged registry produce
 * byte-identical files.
 *
 * Tunables (env):
 *   TRIALS_TOP_N        max studies kept per drug (default 10, max 50)
 *   TRIALS_THROTTLE_MS  delay between requests (default 400ms)
 *
 * Run: npm run ingest:trials
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrugTrialsSchema,
  TrialEntrySchema,
  type DrugTrials,
  type Provenance,
  type TrialEntry,
} from "../../lib/schemas";
import {
  enrichLimit,
  enrichScaleMode,
  loadEnrichmentDrugs,
  openCheckpoint,
} from "./enrich-shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_FILE = resolve(REPO_ROOT, "lib/data/seed/trials.ts");

const EXTRACTED_AT = "2026-06-11T00:00:00.000Z";

const TOP_N = clampInt(process.env.TRIALS_TOP_N, 10, 1, 50);
const THROTTLE_MS = clampInt(process.env.TRIALS_THROTTLE_MS, 400, 0, 5000);

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

interface CtgStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
    };
    designModule?: {
      studyType?: string;
      phases?: string[];
      enrollmentInfo?: { count?: number };
    };
    conditionsModule?: { conditions?: string[] };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
  };
}

interface CtgResponse {
  totalCount?: number;
  studies?: CtgStudy[];
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

function buildQueryUrl(name: string): string {
  const u = new URL("https://clinicaltrials.gov/api/v2/studies");
  u.searchParams.set("query.intr", name);
  u.searchParams.set("pageSize", String(TOP_N));
  u.searchParams.set("countTotal", "true");
  u.searchParams.set("sort", "LastUpdatePostDate:desc");
  u.searchParams.set("fields", "protocolSection");
  return u.toString();
}

async function fetchStudies(name: string): Promise<CtgResponse | null> {
  const url = buildQueryUrl(name);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    process.stderr.write(`  ! HTTP ${res.status} on ${url}\n`);
    return null;
  }
  return (await res.json()) as CtgResponse;
}

function toEntry(study: CtgStudy): TrialEntry | null {
  const p = study.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  const title =
    p?.identificationModule?.briefTitle?.trim() ||
    p?.identificationModule?.officialTitle?.trim();
  const overallStatus = p?.statusModule?.overallStatus?.trim();
  if (!nctId || !title || !overallStatus) return null;

  const studyType = p?.designModule?.studyType?.trim();
  const leadSponsor = p?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim();
  const startDate = p?.statusModule?.startDateStruct?.date;
  const lastUpdateDate = p?.statusModule?.lastUpdatePostDateStruct?.date;
  const enrollment = p?.designModule?.enrollmentInfo?.count;

  const entry: TrialEntry = {
    nctId,
    title,
    overallStatus,
    phases: p?.designModule?.phases ?? [],
    ...(studyType ? { studyType } : {}),
    conditions: (p?.conditionsModule?.conditions ?? []).slice(0, 8),
    ...(leadSponsor ? { leadSponsor } : {}),
    ...(startDate ? { startDate } : {}),
    ...(lastUpdateDate ? { lastUpdateDate } : {}),
    ...(enrollment !== undefined && enrollment >= 0 ? { enrollment } : {}),
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
  try {
    return TrialEntrySchema.parse(entry);
  } catch {
    return null;
  }
}

function buildProvenance(drugName: string, nctIds: string[]): Provenance {
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({ drug: drugName, nctIds }))
    .digest("hex");
  return {
    sourceUrl: buildQueryUrl(drugName),
    sourceHash,
    extractedAt: EXTRACTED_AT,
    extractor: "clinicaltrials-v2",
    confidence: 0.9,
  };
}

function emitSeed(map: Map<string, DrugTrials>): string {
  const slugs = [...map.keys()].sort();
  const body = slugs
    .map((slug) => {
      const entry = map.get(slug)!;
      return `  ${JSON.stringify(slug)}: ${JSON.stringify(entry, null, 2)
        .split("\n")
        .join("\n  ")},`;
    })
    .join("\n");

  return `// AUTO-GENERATED by scripts/ingest/fetch-trials.ts
// Source: ClinicalTrials.gov v2 API — see provenance on each entry.
// Do not edit by hand; re-run \`npm run ingest:trials\` to refresh.
//
// Trials crosswalks require the drug as a registered intervention.
// Registration is NOT evidence of efficacy or safety.

import type { DrugTrials } from "@/lib/schemas";

/**
 * ClinicalTrials.gov study lists keyed by drug slug.
 */
export const SEED_TRIALS: Record<string, DrugTrials> = {
${body}
};

export function getSeedTrials(slug: string): DrugTrials | null {
  return SEED_TRIALS[slug] ?? null;
}
`;
}

async function main(): Promise<void> {
  const scale = enrichScaleMode();
  const limit = enrichLimit();
  let drugs = loadEnrichmentDrugs();
  if (limit) drugs = drugs.slice(0, limit);
  process.stderr.write(
    `[fetch-trials] mode=${scale ? "scale" : "static"} indexing ${drugs.length} drugs ` +
      `(topN=${TOP_N}, throttle=${THROTTLE_MS}ms)\n`,
  );

  const checkpoint = scale
    ? openCheckpoint<DrugTrials>("trials.checkpoint.ndjson", "trials.ndjson")
    : null;
  const out = new Map<string, DrugTrials>();
  let withTrials = 0;
  let processed = 0;

  for (const drug of drugs) {
    processed += 1;
    if (checkpoint?.done(drug.slug)) continue;

    const body = await fetchStudies(drug.name);
    await sleep(THROTTLE_MS);
    if (!body) {
      // transient (HTTP error): leave unrecorded so a resume retries it.
      continue;
    }

    const trials = (body.studies ?? [])
      .map(toEntry)
      .filter((t): t is TrialEntry => t !== null);
    const totalCount = body.totalCount ?? trials.length;
    if (trials.length === 0) {
      checkpoint?.record(drug.slug, null);
      if (!checkpoint) process.stderr.write(`  ${drug.slug}: no registered studies\n`);
      continue;
    }

    const entry: DrugTrials = {
      drug: drug.slug,
      totalCount,
      trials,
      provenance: buildProvenance(
        drug.name,
        trials.map((t) => t.nctId),
      ),
    };
    DrugTrialsSchema.parse(entry);
    out.set(drug.slug, entry);
    checkpoint?.record(drug.slug, entry);
    withTrials += 1;
    if (processed % 100 === 0 || !checkpoint) {
      process.stderr.write(
        `  [${processed}/${drugs.length}] ${drug.slug}: ${trials.length} kept of ${totalCount} registry matches\n`,
      );
    }
  }

  if (checkpoint) {
    const path = checkpoint.flush();
    process.stderr.write(
      `[fetch-trials] wrote ${checkpoint.size} drugs with trials → ${path}\n`,
    );
    return;
  }

  const text = emitSeed(out);
  writeFileSync(OUT_FILE, text, "utf8");
  process.stderr.write(
    `[fetch-trials] wrote ${OUT_FILE} (${withTrials} drugs with trials)\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[fetch-trials] FAILED: ${msg}\n`);
  process.exit(1);
});
