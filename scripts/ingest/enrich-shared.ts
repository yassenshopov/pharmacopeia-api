/**
 * scripts/ingest/enrich-shared.ts
 *
 * Shared plumbing for the per-drug enrichment pipelines (structures,
 * FAERS adverse events, literature, shortages) so they can target the
 * full 5,000+ scale dataset instead of only the curated 310-drug TS
 * seed.
 *
 * The drug universe and the output format are selected the same way the
 * drugs pipeline picks its dataset:
 *
 *  - SCALE  (default when `data/ingest/drugs.ndjson` exists): iterate
 *    every drug in the scale dataset and write enrichment results as
 *    NDJSON under `data/ingest/`, which `scripts/db/seed.ts` loads
 *    straight into Postgres. Nothing bloats the bundle.
 *  - STATIC (fresh clone, or forced with `PHARM_DATASET=static`):
 *    iterate `SEED_DRUGS` (the curated 310) and let each script keep
 *    writing its `lib/data/seed/*.ts` file as before.
 *
 * Keeping this in one place means a new enrichment can opt into scale
 * with three calls — `loadEnrichmentDrugs`, `enrichScaleMode`,
 * `writeEnrichmentNdjson` — and the curated path stays byte-identical.
 */

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

import type { Drug } from "../../lib/schemas";
import { SEED_DRUGS } from "../../lib/data/seed/drugs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ENRICH_DATA_DIR = resolve(__dirname, "../../data/ingest");
const SCALE_DRUGS_FILE = resolve(ENRICH_DATA_DIR, "drugs.ndjson");

/**
 * True when the scale NDJSON dataset is present and not explicitly
 * disabled. Mirrors `resolveDataset()` in scripts/db/seed.ts so the
 * enrichment a script writes always matches the drug set the seed loads.
 */
export function enrichScaleMode(): boolean {
  return process.env.PHARM_DATASET !== "static" && existsSync(SCALE_DRUGS_FILE);
}

/** The drug universe to enrich: the scale dataset, else the curated seed. */
export function loadEnrichmentDrugs(): Drug[] {
  if (enrichScaleMode()) {
    return readFileSync(SCALE_DRUGS_FILE, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Drug);
  }
  return SEED_DRUGS as Drug[];
}

/** Write enrichment rows as `data/ingest/<name>` NDJSON. Returns the path. */
export function writeEnrichmentNdjson(name: string, rows: unknown[]): string {
  mkdirSync(ENRICH_DATA_DIR, { recursive: true });
  const path = resolve(ENRICH_DATA_DIR, name);
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  writeFileSync(path, body, "utf8");
  return path;
}

/** Optional `PHARM_ENRICH_LIMIT` cap for fast smoke tests. */
export function enrichLimit(): number | null {
  const n = Number.parseInt(process.env.PHARM_ENRICH_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Append-only checkpoint for the long per-drug scale runs (FAERS,
 * literature) so a sleeping laptop or a reaped terminal never costs more
 * than the in-flight drug. Each line is `{"slug","value"}` where a null
 * value records "processed, no data" so resumes skip it too.
 *
 * `flush()` writes the deduped non-null values to the final
 * `<final>` NDJSON that db:seed reads.
 */
export interface EnrichCheckpoint<T> {
  done: (slug: string) => boolean;
  record: (slug: string, value: T | null) => void;
  size: number;
  flush: () => string;
}

export function openCheckpoint<T>(
  checkpointName: string,
  finalName: string,
): EnrichCheckpoint<T> {
  mkdirSync(ENRICH_DATA_DIR, { recursive: true });
  const checkpointPath = resolve(ENRICH_DATA_DIR, checkpointName);
  const values = new Map<string, T>();
  const seen = new Set<string>();

  if (existsSync(checkpointPath)) {
    for (const line of readFileSync(checkpointPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const row = JSON.parse(trimmed) as { slug: string; value: T | null };
        seen.add(row.slug);
        if (row.value !== null) values.set(row.slug, row.value);
        else values.delete(row.slug);
      } catch {
        // tolerate a torn final line from a killed process
      }
    }
  }

  return {
    done: (slug) => seen.has(slug),
    record(slug, value) {
      seen.add(slug);
      if (value !== null) values.set(slug, value);
      else values.delete(slug);
      appendFileSync(checkpointPath, JSON.stringify({ slug, value }) + "\n", "utf8");
    },
    get size() {
      return values.size;
    },
    flush() {
      return writeEnrichmentNdjson(finalName, [...values.values()]);
    },
  };
}
