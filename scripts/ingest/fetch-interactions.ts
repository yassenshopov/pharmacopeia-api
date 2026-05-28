/**
 * scripts/ingest/fetch-interactions.ts
 *
 * Real drug-drug interaction data is gated. The free public DDI source —
 * RxNav's /interaction API — was retired in 2024 when its Truven license
 * expired. DrugBank, Lexicomp, and First Databank are commercial.
 *
 * What we *can* ingest for free is the per-drug narrative text in the
 * openFDA drug label "drug_interactions" section. That narrative is
 * one-sided (it describes one drug's interaction surface, not a
 * `drugA × drugB` pair), so it does not fit the pair-graph
 * `Interaction` Zod schema. To preserve the v0 API contract:
 *
 *  - `SEED_INTERACTIONS` (pair-graph) stays empty until a real
 *    structured DDI source lands.
 *  - The narrative text gets stored on the Drug record itself via the
 *    optional `Drug.interactionsNarrative` field, joined at read time
 *    from `lib/data/seed/drug-interactions-narratives.ts`.
 *
 * Idempotent: re-running merges. If the upstream raw narrative hash is
 * unchanged we keep the existing record (and its extractedAt timestamp)
 * untouched; if it changed we overwrite that single entry.
 *
 * Run:   npm run ingest:interactions
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { ProvenanceSchema, type Provenance } from "../../lib/schemas";

// ────────────────────────────────────────────────────────────────────────
// Paths and constants
// ────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(REPO_ROOT, "lib/data/seed");
const OUT_FILE = resolve(OUT_DIR, "drug-interactions-narratives.ts");
const DRUGS_FILE = resolve(OUT_DIR, "drugs.ts");

const EXTRACTOR = "openfda-labels@v1";
const CONFIDENCE = 0.9;
const EXTRACTED_AT = new Date().toISOString();

// ────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "pharmacopeia-ingest/1.0 (+local dev)" },
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(750 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error(`fetch failed: ${url}`);
}

/**
 * openFDA narratives are wrapped in section headers ("7 DRUG INTERACTIONS",
 * "DRUG INTERACTIONS:", numbered subsections, and stray repeats). Strip the
 * outer header and collapse whitespace. Inner subsection numbering is left
 * in place because it carries semantic meaning ("7.1 ACE inhibitors").
 */
function cleanNarrative(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/^\s*\d+(\.\d+)*\s+DRUG\s+INTERACTIONS?[:\s]*/i, "")
    .replace(/^\s*DRUG\s+INTERACTIONS?[:\s]*/i, "")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ────────────────────────────────────────────────────────────────────────
// openFDA lookup
// ────────────────────────────────────────────────────────────────────────

interface NarrativeFetch {
  text: string;
  rawText: string;
  sourceUrl: string;
}

async function fetchDrugInteractionsNarrative(
  name: string,
): Promise<NarrativeFetch | null> {
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/label.json?search=${search}&limit=1`;
  const resp = await fetchJson(url);
  const result = resp?.results?.[0];
  if (!result) return null;

  const raw: string | undefined = result?.drug_interactions?.[0];
  if (!raw || !raw.trim()) return null;

  const cleaned = cleanNarrative(raw);
  if (!cleaned) return null;
  return { text: cleaned, rawText: raw, sourceUrl: url };
}

// ────────────────────────────────────────────────────────────────────────
// Existing-file merge (idempotency)
// ────────────────────────────────────────────────────────────────────────

interface NarrativeRecord {
  text: string;
  provenance: Provenance;
}

async function loadExisting(): Promise<Record<string, NarrativeRecord>> {
  try {
    const mod = await import(pathToFileURL(OUT_FILE).href);
    const existing = mod.SEED_DRUG_INTERACTIONS_NARRATIVES ?? {};
    const out: Record<string, NarrativeRecord> = {};
    for (const [slug, value] of Object.entries(existing) as [
      string,
      NarrativeRecord,
    ][]) {
      const prov = ProvenanceSchema.safeParse(value?.provenance);
      if (
        value &&
        typeof value.text === "string" &&
        value.text.length > 0 &&
        prov.success
      ) {
        out[slug] = { text: value.text, provenance: prov.data };
      }
    }
    return out;
  } catch {
    return {};
  }
}

interface DrugLite {
  slug: string;
  name: string;
}

async function loadSeedDrugs(): Promise<DrugLite[]> {
  const mod = await import(pathToFileURL(DRUGS_FILE).href);
  const list = mod.SEED_DRUGS as Array<{ slug: string; name: string }>;
  if (!Array.isArray(list)) {
    throw new Error("SEED_DRUGS not found in lib/data/seed/drugs.ts");
  }
  return list
    .map((d) => ({ slug: d.slug, name: d.name }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// ────────────────────────────────────────────────────────────────────────
// Emit
// ────────────────────────────────────────────────────────────────────────

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function emitTs(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad1 + emitTs(v, indent + 1));
    return "[\n" + items.join(",\n") + ",\n" + pad + "]";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => {
      const key = SAFE_KEY.test(k) ? k : JSON.stringify(k);
      return pad1 + key + ": " + emitTs(v, indent + 1);
    });
    return "{\n" + lines.join(",\n") + ",\n" + pad + "}";
  }
  throw new Error(`emitTs: unsupported value ${typeof value}`);
}

const HEADER = `import type { Provenance } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-interactions.ts.
 *
 * Per-drug "Drug Interactions" narrative text pulled verbatim from the
 * openFDA label (\`drug_interactions\` field), cleaned of outer section
 * headers, and stamped with provenance. The hash is sha256 of the raw
 * upstream string so a delta refresh can skip unchanged labels.
 *
 * One-sided: each entry describes a single drug's interaction surface,
 * not a \`drugA × drugB\` pair. The pair-graph \`Interaction\` schema
 * stays reserved for the day a structured DDI source becomes available.
 *
 * Edits to this file will be overwritten on the next
 * \`npm run ingest:interactions\`.
 */

export interface DrugInteractionsNarrative {
  text: string;
  provenance: Provenance;
}
`;

function writeOutput(narratives: Record<string, NarrativeRecord>): void {
  const sortedKeys = Object.keys(narratives).sort();
  const sorted: Record<string, NarrativeRecord> = {};
  for (const k of sortedKeys) sorted[k] = narratives[k];

  const body = `${HEADER}
export const SEED_DRUG_INTERACTIONS_NARRATIVES: Record<
  string,
  DrugInteractionsNarrative
> = ${emitTs(sorted)};

export function getSeedInteractionsNarrative(
  slug: string,
): DrugInteractionsNarrative | null {
  return SEED_DRUG_INTERACTIONS_NARRATIVES[slug] ?? null;
}
`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, body, "utf8");
  process.stderr.write(`wrote ${OUT_FILE}\n`);
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const drugs = await loadSeedDrugs();
  const existing = await loadExisting();

  process.stderr.write(
    `Ingesting drug_interactions narratives for ${drugs.length} drugs from openFDA...\n` +
      `  existing entries: ${Object.keys(existing).length}\n\n`,
  );

  const next: Record<string, NarrativeRecord> = {};
  let fetched = 0;
  let reused = 0;
  let missing = 0;
  let errored = 0;

  for (let i = 0; i < drugs.length; i++) {
    const d = drugs[i];
    const tag = `[${i + 1}/${drugs.length}] ${d.slug}`;
    try {
      const fetched1 = await fetchDrugInteractionsNarrative(d.name);
      if (!fetched1) {
        const prior = existing[d.slug];
        if (prior) {
          process.stderr.write(
            `${tag}: ! openFDA returned no drug_interactions; keeping prior entry\n`,
          );
          next[d.slug] = prior;
          reused += 1;
        } else {
          process.stderr.write(`${tag}: – no drug_interactions field\n`);
          missing += 1;
        }
      } else {
        const newHash = sha256(fetched1.rawText).slice(0, 64);
        const prior = existing[d.slug];
        if (prior && prior.provenance.sourceHash === newHash) {
          process.stderr.write(`${tag}: = unchanged (hash match), keeping\n`);
          next[d.slug] = prior;
          reused += 1;
        } else {
          const record: NarrativeRecord = {
            text: fetched1.text,
            provenance: {
              sourceUrl: fetched1.sourceUrl,
              sourceHash: newHash,
              extractedAt: EXTRACTED_AT,
              extractor: EXTRACTOR,
              confidence: CONFIDENCE,
            },
          };
          ProvenanceSchema.parse(record.provenance);
          next[d.slug] = record;
          process.stderr.write(
            `${tag}: + ingested (${fetched1.text.length} chars)\n`,
          );
          fetched += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const prior = existing[d.slug];
      if (prior) {
        process.stderr.write(`${tag}: ! error (${msg}); keeping prior entry\n`);
        next[d.slug] = prior;
        reused += 1;
      } else {
        process.stderr.write(`${tag}: ✗ error: ${msg}\n`);
        errored += 1;
      }
    }
    await sleep(250);
  }

  if (process.env.PHARM_DRY_RUN === "1") {
    process.stderr.write(
      `DRY_RUN: would write ${Object.keys(next).length} narratives; skipping file write.\n`,
    );
  } else {
    writeOutput(next);
  }

  const total = drugs.length;
  process.stderr.write(`\n──────── ingest:interactions summary ────────\n`);
  process.stderr.write(`drugs probed:    ${total}\n`);
  process.stderr.write(`narratives:      ${Object.keys(next).length}\n`);
  process.stderr.write(`  freshly fetched: ${fetched}\n`);
  process.stderr.write(`  reused (hash):   ${reused}\n`);
  process.stderr.write(`no drug_interactions field: ${missing}\n`);
  process.stderr.write(`errored (no prior): ${errored}\n`);
  process.stderr.write(`\nDone.\n`);
}

main().catch((e) => {
  process.stderr.write(`\nFATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
