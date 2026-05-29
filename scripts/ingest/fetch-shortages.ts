/**
 * scripts/ingest/fetch-shortages.ts
 *
 * Pulls FDA drug-shortage records from openFDA and joins them onto the
 * existing drug records by openFDA substance / generic name, writing
 * the result to `lib/data/seed/shortages.ts`.
 *
 * Source: https://api.fda.gov/drug/shortages.json
 *
 * Status mapping (openFDA → schema):
 *   "Current"             → "active"
 *   "Resolved"            → "resolved"
 *   "To Be Discontinued"  → "to-be-discontinued"
 *
 * Anything else is dropped with a one-line note on stderr.
 *
 * Idempotent: deterministic timestamps, sorted output, stable hashing.
 * Re-running produces byte-identical files unless openFDA changed.
 *
 * Run:   npm run ingest:shortages
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ShortageEntrySchema,
  type Provenance,
  type ShortageEntry,
  type ShortageStatus,
} from "../../lib/schemas";
import { SEED_DRUGS_BY_SLUG } from "../../lib/data/seed/drugs";

// ────────────────────────────────────────────────────────────────────────
// Paths and constants
// ────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_FILE = resolve(REPO_ROOT, "lib/data/seed/shortages.ts");

// Deterministic fixed timestamp so re-runs do not diff just because of
// clock. Refreshing per-record provenance.extractedAt would otherwise
// guarantee a noisy diff every single run.
const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

const OPENFDA_URL = "https://api.fda.gov/drug/shortages.json";
const PAGE_LIMIT = 100;
const MAX_PAGES = 100; // 10,000 entries cap — more than current openFDA volume

// ────────────────────────────────────────────────────────────────────────
// openFDA types (loose; we validate at the boundary)
// ────────────────────────────────────────────────────────────────────────

interface OpenFdaShortageRecord {
  generic_name?: string | string[];
  presentation?: string | string[];
  status?: string | string[];
  shortage_reason?: string | string[];
  therapeutic_category?: string | string[];
  company_name?: string | string[];
  update_date?: string | string[];
  related_info?: string | string[];
  openfda?: {
    generic_name?: string[];
    brand_name?: string[];
    substance_name?: string[];
  };
}

/**
 * openFDA returns some fields as strings on most rows but as arrays on
 * a handful — `therapeutic_category` in particular. Coerce to a single
 * trimmed string at the boundary so the rest of the script doesn't
 * have to care.
 */
function asString(v: string | string[] | undefined): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim().length > 0);
    return first?.trim();
  }
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

interface OpenFdaPage {
  meta?: { results?: { total?: number; skip?: number; limit?: number } };
  results?: OpenFdaShortageRecord[];
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusFromOpenFda(raw: string | undefined): ShortageStatus | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "current") return "active";
  if (n === "resolved") return "resolved";
  if (n === "discontinued" || n === "discontinuation") return "discontinuation";
  if (n === "to be discontinued") return "to-be-discontinued";
  return null;
}

function presentationOf(rec: OpenFdaShortageRecord): string {
  // openFDA's `presentation` is already a human-readable string —
  // e.g. "Naropin, Injection, 10 mg/1 mL (NDC 63323-288-10)". Use it
  // verbatim when present and fall back to the raw generic_name if
  // openFDA didn't supply one for the row.
  const explicit = asString(rec.presentation);
  if (explicit) return explicit;
  const generic = asString(rec.generic_name);
  if (generic) return generic;
  return "Unspecified presentation";
}

/**
 * Parse the openFDA shortage date format (`MM/DD/YYYY`, e.g.
 * "05/26/2026") into ISO `YYYY-MM-DD`. Falls back to the static
 * extraction date when the value is missing or unparseable so the seed
 * row still passes `z.string().date()` validation.
 */
function toIsoDate(raw: string | undefined): string {
  if (!raw) return EXTRACTED_AT.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const usFormat = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usFormat) {
    const [, mm, dd, yyyy] = usFormat;
    return `${yyyy}-${mm}-${dd}`;
  }
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return EXTRACTED_AT.slice(0, 10);
  return new Date(ts).toISOString().slice(0, 10);
}

function hashRecord(rec: OpenFdaShortageRecord): string {
  // Hash a stable subset of fields so re-runs against the same upstream
  // produce identical provenance.sourceHash values.
  const key = JSON.stringify({
    g: asString(rec.generic_name) ?? null,
    p: asString(rec.presentation) ?? null,
    st: asString(rec.status) ?? null,
    u: asString(rec.update_date) ?? null,
    c: asString(rec.company_name) ?? null,
  });
  return createHash("sha256").update(key).digest("hex");
}

// ────────────────────────────────────────────────────────────────────────
// openFDA paging
// ────────────────────────────────────────────────────────────────────────

async function fetchAllRecords(): Promise<OpenFdaShortageRecord[]> {
  const out: OpenFdaShortageRecord[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * PAGE_LIMIT;
    const url = `${OPENFDA_URL}?limit=${PAGE_LIMIT}&skip=${skip}`;
    process.stderr.write(`[fetch-shortages] GET ${url}\n`);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      // openFDA returns 404 when skip exceeds the result set.
      break;
    }
    if (!res.ok) {
      throw new Error(`openFDA returned ${res.status} on page ${page}`);
    }
    const body = (await res.json()) as OpenFdaPage;
    const results = body.results ?? [];
    out.push(...results);
    if (results.length < PAGE_LIMIT) break;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// Crosswalk + serialise
// ────────────────────────────────────────────────────────────────────────

function buildCrosswalk(): Map<string, string> {
  // Substance / ingredient name (lowercased) → drug slug. We index
  // every drug by name and every component ingredient so a shortage
  // row tagged with the substance name still finds its drug record.
  const map = new Map<string, string>();
  for (const drug of Object.values(SEED_DRUGS_BY_SLUG)) {
    map.set(drug.name.toLowerCase(), drug.slug);
    for (const ing of drug.ingredients) {
      map.set(ing.name.toLowerCase(), drug.slug);
    }
  }
  return map;
}

/**
 * Pull every candidate join key out of a single openFDA shortage row.
 * `openfda.substance_name` and `openfda.generic_name` are the
 * authoritative canonical forms (uppercased substance only); the
 * top-level `generic_name` is a presentation string that often glues
 * the dosage form onto the name ("Levothyroxine Sodium Tablet") and
 * is unsuitable as a join key on its own.
 */
function joinCandidates(rec: OpenFdaShortageRecord): string[] {
  const out = new Set<string>();
  for (const n of rec.openfda?.substance_name ?? []) {
    if (n) out.add(n.trim().toLowerCase());
  }
  for (const n of rec.openfda?.generic_name ?? []) {
    if (n) out.add(n.trim().toLowerCase());
  }
  const generic = asString(rec.generic_name);
  if (generic) {
    const lower = generic.toLowerCase();
    out.add(lower);
    // Strip the trailing dosage-form word that openFDA glues onto the
    // generic_name ("Levothyroxine Sodium Tablet" → "levothyroxine sodium").
    const stripped = lower
      .replace(
        /\s+(tablet|tablets|capsule|capsules|injection|injectable|solution|suspension|cream|ointment|gel|spray|inhalation|inhaler|patch|powder|syrup|drops|extended release|oral)\b.*$/i,
        "",
      )
      .trim();
    if (stripped) out.add(stripped);
  }
  return [...out];
}

function buildEntries(
  records: OpenFdaShortageRecord[],
  crosswalk: Map<string, string>,
): Map<string, ShortageEntry[]> {
  const bySlug = new Map<string, ShortageEntry[]>();
  let unmatched = 0;
  let unknownStatus = 0;

  for (const rec of records) {
    const candidates = joinCandidates(rec);
    let slug: string | undefined;
    for (const cand of candidates) {
      const hit = crosswalk.get(cand);
      if (hit) {
        slug = hit;
        break;
      }
    }
    if (!slug) {
      unmatched += 1;
      continue;
    }
    const status = statusFromOpenFda(asString(rec.status));
    if (!status) {
      unknownStatus += 1;
      continue;
    }

    const sourceHash = hashRecord(rec);
    const provenance: Provenance = {
      sourceUrl: OPENFDA_URL,
      sourceHash,
      extractedAt: EXTRACTED_AT,
      extractor: "openfda-shortages",
      confidence: 0.9,
    };

    const therapeuticCategory = asString(rec.therapeutic_category);
    const sponsor = asString(rec.company_name);
    const reason = asString(rec.shortage_reason);

    const entry: ShortageEntry = {
      drug: slug,
      status,
      presentation: presentationOf(rec),
      ...(sponsor ? { sponsor } : {}),
      ...(reason ? { reason } : {}),
      ...(therapeuticCategory ? { therapeuticCategory } : {}),
      fdaUpdatedAt: toIsoDate(asString(rec.update_date)),
      provenance,
    };
    ShortageEntrySchema.parse(entry);

    const arr = bySlug.get(slug) ?? [];
    arr.push(entry);
    bySlug.set(slug, arr);
  }

  // Stable per-slug ordering: presentation then status.
  for (const arr of bySlug.values()) {
    arr.sort((a, b) => {
      if (a.presentation !== b.presentation) {
        return a.presentation.localeCompare(b.presentation);
      }
      return a.status.localeCompare(b.status);
    });
  }

  process.stderr.write(
    `[fetch-shortages] ${records.length} openFDA rows → ` +
      `${[...bySlug.values()].reduce((n, a) => n + a.length, 0)} entries / ` +
      `${bySlug.size} drugs (skipped: ${unmatched} unmatched, ${unknownStatus} unknown-status)\n`,
  );

  return bySlug;
}

function emitSeed(entries: Map<string, ShortageEntry[]>): string {
  const slugs = [...entries.keys()].sort();
  const blocks = slugs.map((slug) => {
    const lines = entries.get(slug)!.map((e) => {
      const fields = [
        `      drug: ${JSON.stringify(e.drug)},`,
        `      status: ${JSON.stringify(e.status)},`,
        `      presentation: ${JSON.stringify(e.presentation)},`,
      ];
      if (e.sponsor) fields.push(`      sponsor: ${JSON.stringify(e.sponsor)},`);
      if (e.reason) fields.push(`      reason: ${JSON.stringify(e.reason)},`);
      if (e.therapeuticCategory) {
        fields.push(
          `      therapeuticCategory: ${JSON.stringify(e.therapeuticCategory)},`,
        );
      }
      fields.push(`      fdaUpdatedAt: ${JSON.stringify(e.fdaUpdatedAt)},`);
      fields.push(`      provenance: {`);
      fields.push(`        sourceUrl: ${JSON.stringify(e.provenance.sourceUrl)},`);
      fields.push(`        sourceHash: ${JSON.stringify(e.provenance.sourceHash)},`);
      fields.push(`        extractedAt: ${JSON.stringify(e.provenance.extractedAt)},`);
      fields.push(`        extractor: ${JSON.stringify(e.provenance.extractor)},`);
      fields.push(`        confidence: ${e.provenance.confidence},`);
      fields.push(`      },`);
      return `    {\n${fields.join("\n")}\n    },`;
    });
    return `  ${JSON.stringify(slug)}: [\n${lines.join("\n")}\n  ],`;
  });

  return `// AUTO-GENERATED by scripts/ingest/fetch-shortages.ts
// Source: openFDA drug/shortages — see provenance.sourceUrl on each entry.
// Do not edit by hand; re-run \`npm run ingest:shortages\` to refresh.
//
// Reference statistics only — FDA shortage status changes frequently.
// For a live view, consult the FDA drug shortages database directly:
// https://www.accessdata.fda.gov/scripts/drugshortages/

import type { ShortageEntry } from "@/lib/schemas";

/**
 * Shortage entries keyed by drug slug. A drug may have multiple
 * entries (one per affected presentation).
 */
export const SEED_SHORTAGES: Record<string, ShortageEntry[]> = {
${blocks.join("\n")}
};

export function getSeedShortages(slug: string): ShortageEntry[] {
  return SEED_SHORTAGES[slug] ?? [];
}

export function listAllSeedShortages(): ShortageEntry[] {
  const all: ShortageEntry[] = [];
  for (const entries of Object.values(SEED_SHORTAGES)) {
    all.push(...entries);
  }
  return all.sort((a, b) => {
    if (a.drug !== b.drug) return a.drug.localeCompare(b.drug);
    return a.presentation.localeCompare(b.presentation);
  });
}
`;
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const records = await fetchAllRecords();
  const crosswalk = buildCrosswalk();
  const entries = buildEntries(records, crosswalk);
  const text = emitSeed(entries);
  writeFileSync(OUT_FILE, text, "utf8");
  process.stderr.write(`[fetch-shortages] wrote ${OUT_FILE}\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[fetch-shortages] FAILED: ${msg}\n`);
  process.exit(1);
});
