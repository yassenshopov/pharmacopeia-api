/**
 * scripts/ingest/fetch-drugs-scale.ts
 *
 * The 5,000+ drug scale ingest. Walks the programmatic candidate
 * universe (data/ingest/universe.json, built by `npm run
 * ingest:universe`), resolves each candidate against RxNav + openFDA
 * with the exact same shared record builder the curated pipeline uses,
 * and writes NDJSON artifacts that `npm run db:seed` loads straight
 * into Supabase. The static TS seed stays the small curated bundle
 * fallback; the scale dataset lives only in the database.
 *
 * Throughput design (a full run probes ~14k candidates):
 *
 *  - CONCURRENT: a small worker pool (PHARM_CONCURRENCY, default 4)
 *    overlaps requests; per-host rate limits live in shared.ts.
 *  - CHECKPOINTED: every candidate verdict is appended to
 *    data/ingest/checkpoint.ndjson the moment it lands. Kill the run
 *    at any point and re-run to resume — finished candidates are never
 *    re-fetched (failed ones are retried).
 *  - GATED: a candidate is published only if it has a real openFDA
 *    label (the US-FDA membership test) or is on the curated core
 *    list. Resolved-but-unlabeled candidates land in review.ndjson —
 *    never in the public dataset — matching the project's "below
 *    threshold goes to review" rule.
 *  - ABORT-SAFE: sustained openFDA 429s (the no-key 1,000/day cap)
 *    abort the run instead of poisoning thousands of checkpoint rows.
 *
 * Set OPENFDA_API_KEY (free: https://open.fda.gov/apis/authentication/)
 * before a full run — it lifts the openFDA daily cap to 120,000.
 *
 * Run:
 *   npm run ingest:universe          # once, builds the candidate list
 *   npm run ingest:scale             # resumable; repeat until done
 *   npm run ingest:scale -- --assemble-only   # rebuild artifacts only
 *
 * Env:
 *   PHARM_CONCURRENCY=4    worker pool size
 *   PHARM_SCALE_LIMIT=200  process at most N pending candidates this run
 *   OPENFDA_API_KEY=...    openFDA key (effectively required at scale)
 */

import "dotenv/config";
import "dotenv/config";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Drug, DrugClass, Ingredient } from "../../lib/schemas";
import type { UniverseCandidate, UniverseFile } from "./build-universe";
import {
  COVERAGE_KEYS,
  type CoverageBits,
  RateLimitExhaustedError,
  finalizeDataset,
  ingestCandidate,
} from "./shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const DATA_DIR = resolve(REPO_ROOT, "data/ingest");
const UNIVERSE_FILE = resolve(DATA_DIR, "universe.json");
const CHECKPOINT_FILE = resolve(DATA_DIR, "checkpoint.ndjson");
const DRUGS_FILE = resolve(DATA_DIR, "drugs.ndjson");
const INGREDIENTS_FILE = resolve(DATA_DIR, "ingredients.ndjson");
const CLASSES_FILE = resolve(DATA_DIR, "classes.ndjson");
const REVIEW_FILE = resolve(DATA_DIR, "review.ndjson");
const REPORT_FILE = resolve(DATA_DIR, "report.json");

type Status = "ok" | "review" | "skip" | "error";

interface CheckpointLine {
  slug: string;
  name: string;
  tier: UniverseCandidate["tier"];
  status: Status;
  reason?: string;
  drug?: Drug;
  ingredient?: Ingredient;
  classes?: DrugClass[];
  coverage?: CoverageBits;
  at: string;
}

function loadUniverse(): UniverseFile {
  if (!existsSync(UNIVERSE_FILE)) {
    throw new Error(
      `missing ${UNIVERSE_FILE} — run \`npm run ingest:universe\` first`,
    );
  }
  return JSON.parse(readFileSync(UNIVERSE_FILE, "utf8")) as UniverseFile;
}

/** Latest checkpoint line per slug (later lines supersede earlier ones). */
function loadCheckpoint(): Map<string, CheckpointLine> {
  const map = new Map<string, CheckpointLine>();
  if (!existsSync(CHECKPOINT_FILE)) return map;
  for (const line of readFileSync(CHECKPOINT_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as CheckpointLine;
      if (parsed?.slug && parsed?.status) map.set(parsed.slug, parsed);
    } catch {
      // torn final line from a killed run — ignore, candidate is retried
    }
  }
  return map;
}

function appendCheckpoint(line: CheckpointLine): void {
  appendFileSync(CHECKPOINT_FILE, JSON.stringify(line) + "\n", "utf8");
}

// ────────────────────────────────────────────────────────────────────────
// Fetch loop
// ────────────────────────────────────────────────────────────────────────

async function processCandidate(c: UniverseCandidate): Promise<CheckpointLine> {
  const at = new Date().toISOString();
  let built;
  try {
    built = await ingestCandidate(c.name, c.rxcui, {
      includeInteractionsNarrative: true,
    });
  } catch (e) {
    if (e instanceof RateLimitExhaustedError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    return { slug: c.slug, name: c.name, tier: c.tier, status: "error", reason: msg, at };
  }
  if (!built) {
    return { slug: c.slug, name: c.name, tier: c.tier, status: "skip", reason: "no-rxcui", at };
  }

  // Publish gate: an openFDA label is the US-FDA membership test for
  // programmatic candidates. The curated core list keeps its legacy
  // no-label allowance so the scale dataset is a superset of the seed.
  const publish = built.coverage.label || c.tier === "curated";
  return {
    slug: c.slug,
    name: c.name,
    tier: c.tier,
    status: publish ? "ok" : "review",
    reason: publish ? undefined : "no-openfda-label",
    drug: built.drug,
    ingredient: built.ingredient,
    classes: built.classes,
    coverage: built.coverage,
    at,
  };
}

async function runFetchLoop(
  universe: UniverseFile,
  checkpoint: Map<string, CheckpointLine>,
): Promise<void> {
  const pending = universe.candidates.filter((c) => {
    const prior = checkpoint.get(c.slug);
    return !prior || prior.status === "error";
  });

  const limit = Number.parseInt(process.env.PHARM_SCALE_LIMIT ?? "", 10);
  const batch =
    Number.isFinite(limit) && limit > 0 ? pending.slice(0, limit) : pending;
  const concurrency = Math.max(
    1,
    Number.parseInt(process.env.PHARM_CONCURRENCY ?? "4", 10) || 4,
  );

  process.stderr.write(
    `universe: ${universe.candidates.length} candidates ` +
      `(${checkpoint.size} checkpointed, ${pending.length} pending)\n` +
      `this run: ${batch.length} candidates, concurrency ${concurrency}\n` +
      (process.env.OPENFDA_API_KEY
        ? ""
        : `WARNING: OPENFDA_API_KEY not set — openFDA caps at 1,000 requests/day without it\n`) +
      `\n`,
  );
  if (batch.length === 0) return;

  const startedAt = Date.now();
  const counts: Record<Status, number> = { ok: 0, review: 0, skip: 0, error: 0 };
  let done = 0;
  let next = 0;
  let aborted: Error | null = null;
  // A lone rate-limit exhaustion is a transient upstream wobble — the
  // candidate is checkpointed as a retryable error and the run goes on.
  // Several in a row means the budget is truly gone (e.g. the no-key
  // daily cap): stop instead of poisoning thousands of checkpoint rows.
  let consecutiveRateLimits = 0;
  const MAX_CONSECUTIVE_RATE_LIMITS = 3;

  async function worker(): Promise<void> {
    while (!aborted) {
      const idx = next++;
      if (idx >= batch.length) return;
      const c = batch[idx];
      let line: CheckpointLine;
      try {
        line = await processCandidate(c);
        consecutiveRateLimits = 0;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        consecutiveRateLimits++;
        if (consecutiveRateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) {
          aborted = err;
          return;
        }
        process.stderr.write(
          `! ${c.slug}: ${err.message} (will retry next run)\n`,
        );
        line = {
          slug: c.slug,
          name: c.name,
          tier: c.tier,
          status: "error",
          reason: err.message,
          at: new Date().toISOString(),
        };
      }
      appendCheckpoint(line);
      checkpoint.set(line.slug, line);
      counts[line.status]++;
      done++;
      if (done % 25 === 0 || done === batch.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(elapsed, 1);
        const etaMin = (batch.length - done) / Math.max(rate, 0.01) / 60;
        process.stderr.write(
          `[${done}/${batch.length}] ok=${counts.ok} review=${counts.review} ` +
            `skip=${counts.skip} error=${counts.error} ` +
            `(${rate.toFixed(2)}/s, ~${etaMin.toFixed(0)} min left)\n`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (aborted) {
    // process.exitCode (not process.exit) so piped stderr flushes — a
    // hard exit can swallow this message entirely.
    process.stderr.write(
      `\nABORTED: ${(aborted as Error).message}\n` +
        `progress is checkpointed — re-run \`npm run ingest:scale\` to resume.\n`,
    );
    process.exitCode = 1;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Assembly: checkpoint → NDJSON artifacts + report
// ────────────────────────────────────────────────────────────────────────

function assemble(checkpoint: Map<string, CheckpointLine>): void {
  const okLines = [...checkpoint.values()].filter(
    (l): l is Required<Pick<CheckpointLine, "drug" | "ingredient" | "classes" | "coverage">> &
      CheckpointLine => l.status === "ok" && !!l.drug && !!l.ingredient && !!l.classes,
  );
  const reviewLines = [...checkpoint.values()]
    .filter((l) => l.status === "review")
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const { drugs, ingredients, classes } = finalizeDataset(
    okLines.map((l) => ({
      drug: l.drug,
      ingredient: l.ingredient,
      classes: l.classes,
    })),
  );

  const ndjson = (rows: unknown[]) =>
    rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DRUGS_FILE, ndjson(drugs), "utf8");
  writeFileSync(INGREDIENTS_FILE, ndjson(ingredients), "utf8");
  writeFileSync(CLASSES_FILE, ndjson(classes), "utf8");
  writeFileSync(
    REVIEW_FILE,
    ndjson(
      reviewLines.map((l) => ({
        slug: l.slug,
        name: l.name,
        tier: l.tier,
        reason: l.reason,
        drug: l.drug,
      })),
    ),
    "utf8",
  );

  // Coverage + status report — the review-throughput dashboard.
  const statusCounts: Record<Status, number> = { ok: 0, review: 0, skip: 0, error: 0 };
  const tierCounts: Record<string, Record<Status, number>> = {};
  for (const l of checkpoint.values()) {
    statusCounts[l.status]++;
    tierCounts[l.tier] ??= { ok: 0, review: 0, skip: 0, error: 0 };
    tierCounts[l.tier][l.status]++;
  }
  const coverage: Record<string, number> = {};
  for (const k of COVERAGE_KEYS) coverage[k] = 0;
  for (const l of okLines) {
    for (const k of COVERAGE_KEYS) {
      if (l.coverage?.[k]) coverage[k]++;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    candidatesProcessed: checkpoint.size,
    status: statusCounts,
    byTier: tierCounts,
    published: {
      drugs: drugs.length,
      ingredients: ingredients.length,
      classes: classes.length,
    },
    coverage: Object.fromEntries(
      Object.entries(coverage).map(([k, v]) => [
        k,
        { count: v, pct: drugs.length ? Math.round((v / drugs.length) * 1000) / 10 : 0 },
      ]),
    ),
  };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  process.stderr.write(
    `\n──────── scale dataset ────────\n` +
      `published drugs:  ${drugs.length}\n` +
      `ingredients:      ${ingredients.length}\n` +
      `classes:          ${classes.length}\n` +
      `in review:        ${reviewLines.length}\n` +
      `skipped:          ${statusCounts.skip}\n` +
      `errored:          ${statusCounts.error}\n` +
      `\ncoverage (of published):\n` +
      COVERAGE_KEYS.map(
        (k) => `  ${k.padEnd(18)} ${coverage[k]}/${drugs.length}\n`,
      ).join("") +
      `\nwrote ${DRUGS_FILE}\n` +
      `wrote ${INGREDIENTS_FILE}\n` +
      `wrote ${CLASSES_FILE}\n` +
      `wrote ${REVIEW_FILE}\n` +
      `wrote ${REPORT_FILE}\n` +
      `\nNext: npm run db:seed (loads the scale dataset when present), then npm run db:embed.\n`,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const assembleOnly = process.argv.includes("--assemble-only");

  const universe = loadUniverse();
  const checkpoint = loadCheckpoint();

  if (!assembleOnly) {
    await runFetchLoop(universe, checkpoint);
  }
  assemble(checkpoint);
}

main().catch((e) => {
  process.stderr.write(`\nFATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
