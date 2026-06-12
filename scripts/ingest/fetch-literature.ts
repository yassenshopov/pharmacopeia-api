/**
 * scripts/ingest/fetch-literature.ts
 *
 * Crosswalks every drug in the dataset to a small curated set of
 * PubMed references via the NCBI E-utilities API (esearch +
 * esummary). Results are written to `lib/data/seed/literature.ts`.
 *
 * Strategy:
 *  - esearch with `<name>[MeSH Major Topic]` to keep precision high.
 *  - Sort by `pub date` desc so the most recent canonical references
 *    surface first. (Most-cited is unavailable without iCite tooling.)
 *  - Cap at LIT_TOP_N references per drug.
 *  - esummary the resulting PMIDs to get title, journal, year, first
 *    few authors, and the DOI when present.
 *
 * Idempotent: deterministic provenance.extractedAt, sorted output,
 * stable hashing. Re-runs against an unchanged PubMed index produce
 * byte-identical files.
 *
 * Tunables (env):
 *   LIT_TOP_N         max references per drug (default 8, max 50)
 *   LIT_THROTTLE_MS   delay between requests (default 350ms — 3 req/s
 *                     limit without an NCBI API key; pass NCBI_API_KEY
 *                     to lift the limit to 10 req/s)
 *   NCBI_API_KEY      NCBI API key for higher rate limit
 *   NCBI_EMAIL        contact email NCBI requests in the tool param
 *
 * Run: npm run ingest:literature
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrugLiteratureSchema,
  LiteratureReferenceSchema,
  type DrugLiterature,
  type LiteratureReference,
  type Provenance,
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
const OUT_FILE = resolve(REPO_ROOT, "lib/data/seed/literature.ts");

const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

const TOP_N = clampInt(process.env.LIT_TOP_N, 8, 1, 50);
const THROTTLE_MS = clampInt(
  process.env.LIT_THROTTLE_MS,
  process.env.NCBI_API_KEY ? 110 : 350,
  0,
  5000,
);
const NCBI_KEY = process.env.NCBI_API_KEY ?? "";
const TOOL = "pharmacopeia";
const CONTACT = process.env.NCBI_EMAIL ?? "agents@pharmacopeia.dev";

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

interface ESearchResponse {
  esearchresult?: {
    count?: string;
    idlist?: string[];
  };
}

interface ESummaryAuthor {
  name?: string;
}

interface ESummaryArticleId {
  idtype?: string;
  value?: string;
}

interface ESummaryResult {
  uid?: string;
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  authors?: ESummaryAuthor[];
  articleids?: ESummaryArticleId[];
}

interface ESummaryResponse {
  result?: Record<string, ESummaryResult | string[] | undefined> & {
    uids?: string[];
  };
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

function commonParams(): Record<string, string> {
  const p: Record<string, string> = {
    tool: TOOL,
    email: CONTACT,
    retmode: "json",
  };
  if (NCBI_KEY) p.api_key = NCBI_KEY;
  return p;
}

function buildUrl(endpoint: string, params: Record<string, string>): string {
  const u = new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    process.stderr.write(`  ! HTTP ${res.status} on ${url}\n`);
    return null;
  }
  return (await res.json()) as T;
}

function extractYear(pubdate: string | undefined): number | null {
  if (!pubdate) return null;
  const m = pubdate.match(/\b(\d{4})\b/);
  if (!m) return null;
  const year = Number.parseInt(m[1], 10);
  if (!Number.isFinite(year)) return null;
  return year;
}

function pickDoi(ids: ESummaryArticleId[] | undefined): string | undefined {
  if (!ids) return undefined;
  for (const id of ids) {
    if (id.idtype?.toLowerCase() === "doi" && id.value) return id.value;
  }
  return undefined;
}

async function searchPmids(name: string): Promise<string[]> {
  const url = buildUrl("esearch.fcgi", {
    ...commonParams(),
    db: "pubmed",
    term: `${name}[MeSH Major Topic]`,
    retmax: String(TOP_N),
    sort: "pub+date",
  });
  const body = await fetchJson<ESearchResponse>(url);
  return body?.esearchresult?.idlist ?? [];
}

async function summarisePmids(
  pmids: string[],
): Promise<ESummaryResult[]> {
  if (pmids.length === 0) return [];
  const url = buildUrl("esummary.fcgi", {
    ...commonParams(),
    db: "pubmed",
    id: pmids.join(","),
  });
  const body = await fetchJson<ESummaryResponse>(url);
  const result = body?.result;
  if (!result) return [];
  const uids = (result.uids as string[] | undefined) ?? pmids;
  const out: ESummaryResult[] = [];
  for (const uid of uids) {
    const item = result[uid];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      out.push(item as ESummaryResult);
    }
  }
  return out;
}

function toReference(summary: ESummaryResult): LiteratureReference | null {
  const pmid = summary.uid;
  const title = summary.title?.trim();
  const journal =
    summary.fulljournalname?.trim() || summary.source?.trim();
  const year = extractYear(summary.pubdate);
  if (!pmid || !title || !journal || year === null) return null;
  const authors = (summary.authors ?? [])
    .map((a) => a.name?.trim())
    .filter((a): a is string => Boolean(a))
    .slice(0, 3);
  const doi = pickDoi(summary.articleids);
  const ref: LiteratureReference = {
    pmid,
    title,
    journal,
    year,
    authors,
    ...(doi ? { doi } : {}),
    pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  };
  try {
    return LiteratureReferenceSchema.parse(ref);
  } catch {
    return null;
  }
}

function buildProvenance(
  drugName: string,
  pmids: string[],
): Provenance {
  const sourceUrl = buildUrl("esearch.fcgi", {
    ...commonParams(),
    db: "pubmed",
    term: `${drugName}[MeSH Major Topic]`,
    retmax: String(TOP_N),
    sort: "pub+date",
    api_key: NCBI_KEY ? "<redacted>" : "",
  });
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({ drug: drugName, pmids }))
    .digest("hex");
  return {
    sourceUrl,
    sourceHash,
    extractedAt: EXTRACTED_AT,
    extractor: "pubmed-eutils",
    confidence: 0.9,
  };
}

function emitSeed(map: Map<string, DrugLiterature>): string {
  const slugs = [...map.keys()].sort();
  const blocks = slugs.map((slug) => {
    const entry = map.get(slug)!;
    const refs = entry.references
      .map((r) => {
        const fields = [
          `      pmid: ${JSON.stringify(r.pmid)},`,
          `      title: ${JSON.stringify(r.title)},`,
          `      journal: ${JSON.stringify(r.journal)},`,
          `      year: ${r.year},`,
          `      authors: ${JSON.stringify(r.authors)},`,
        ];
        if (r.doi) fields.push(`      doi: ${JSON.stringify(r.doi)},`);
        fields.push(`      pubmedUrl: ${JSON.stringify(r.pubmedUrl)},`);
        return `    {\n${fields.join("\n")}\n    },`;
      })
      .join("\n");
    return [
      `  ${JSON.stringify(slug)}: {`,
      `    drug: ${JSON.stringify(entry.drug)},`,
      `    references: [`,
      refs,
      `    ],`,
      `    provenance: {`,
      `      sourceUrl: ${JSON.stringify(entry.provenance.sourceUrl)},`,
      `      sourceHash: ${JSON.stringify(entry.provenance.sourceHash)},`,
      `      extractedAt: ${JSON.stringify(entry.provenance.extractedAt)},`,
      `      extractor: ${JSON.stringify(entry.provenance.extractor)},`,
      `      confidence: ${entry.provenance.confidence},`,
      `    },`,
      `  },`,
    ].join("\n");
  });

  return `// AUTO-GENERATED by scripts/ingest/fetch-literature.ts
// Source: NCBI E-utilities (esearch + esummary) — see provenance on each entry.
// Do not edit by hand; re-run \`npm run ingest:literature\` to refresh.
//
// PubMed crosswalks pin to MeSH major topic for precision.

import type { DrugLiterature } from "@/lib/schemas";

/**
 * PubMed reference lists keyed by drug slug.
 */
export const SEED_LITERATURE: Record<string, DrugLiterature> = {
${blocks.join("\n")}
};

export function getSeedLiterature(slug: string): DrugLiterature | null {
  return SEED_LITERATURE[slug] ?? null;
}
`;
}

async function main(): Promise<void> {
  const scale = enrichScaleMode();
  const limit = enrichLimit();
  let drugs = loadEnrichmentDrugs();
  if (limit) drugs = drugs.slice(0, limit);
  process.stderr.write(
    `[fetch-literature] mode=${scale ? "scale" : "static"} indexing ${drugs.length} drugs ` +
      `(topN=${TOP_N}, throttle=${THROTTLE_MS}ms${NCBI_KEY ? ", api_key set" : ""})\n`,
  );

  const checkpoint = scale
    ? openCheckpoint<DrugLiterature>(
        "literature.checkpoint.ndjson",
        "literature.ndjson",
      )
    : null;
  const out = new Map<string, DrugLiterature>();
  let withRefs = 0;
  let processed = 0;

  for (const drug of drugs) {
    processed += 1;
    if (checkpoint?.done(drug.slug)) continue;

    const pmids = await searchPmids(drug.name);
    await sleep(THROTTLE_MS);
    if (pmids.length === 0) {
      checkpoint?.record(drug.slug, null);
      if (!checkpoint) process.stderr.write(`  ${drug.slug}: no MeSH-major-topic hits\n`);
      continue;
    }
    const summaries = await summarisePmids(pmids);
    await sleep(THROTTLE_MS);
    const references = summaries
      .map(toReference)
      .filter((r): r is LiteratureReference => r !== null);
    if (references.length === 0) {
      checkpoint?.record(drug.slug, null);
      if (!checkpoint) process.stderr.write(`  ${drug.slug}: no valid summaries\n`);
      continue;
    }
    const entry: DrugLiterature = {
      drug: drug.slug,
      references,
      provenance: buildProvenance(drug.name, references.map((r) => r.pmid)),
    };
    DrugLiteratureSchema.parse(entry);
    out.set(drug.slug, entry);
    checkpoint?.record(drug.slug, entry);
    withRefs += 1;
    if (processed % 100 === 0 || !checkpoint) {
      process.stderr.write(
        `  [${processed}/${drugs.length}] ${drug.slug}: ${references.length} references\n`,
      );
    }
  }

  if (checkpoint) {
    const path = checkpoint.flush();
    process.stderr.write(
      `[fetch-literature] wrote ${checkpoint.size} drugs with references → ${path}\n`,
    );
    return;
  }

  const text = emitSeed(out);
  writeFileSync(OUT_FILE, text, "utf8");
  process.stderr.write(
    `[fetch-literature] wrote ${OUT_FILE} (${withRefs} drugs with references)\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[fetch-literature] FAILED: ${msg}\n`);
  process.exit(1);
});
