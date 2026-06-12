/**
 * lib/ingest/shortages.ts
 *
 * Shared openFDA drug-shortage ingest logic, consumed by both:
 *   - scripts/ingest/fetch-shortages.ts  (writes the TS seed file)
 *   - app/api/cron/refresh-shortages     (writes Postgres on a schedule)
 *
 * Per AGENTS.md, per-record pipeline logic must never be duplicated
 * between pipelines — fetching, status mapping, join-key derivation,
 * and entry building all live here as pure functions.
 */

import { createHash } from "node:crypto";

import {
  ShortageEntrySchema,
  type Provenance,
  type ShortageEntry,
  type ShortageStatus,
} from "@/lib/schemas";

export const OPENFDA_SHORTAGES_URL = "https://api.fda.gov/drug/shortages.json";

const PAGE_LIMIT = 100;
const MAX_PAGES = 100; // 10,000 entries cap — more than current openFDA volume

// ────────────────────────────────────────────────────────────────────────
// openFDA types (loose; we validate at the boundary)
// ────────────────────────────────────────────────────────────────────────

export interface OpenFdaShortageRecord {
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

interface OpenFdaPage {
  meta?: { results?: { total?: number; skip?: number; limit?: number } };
  results?: OpenFdaShortageRecord[];
}

/**
 * openFDA returns some fields as strings on most rows but as arrays on
 * a handful — `therapeutic_category` in particular. Coerce to a single
 * trimmed string at the boundary so the rest of the pipeline doesn't
 * have to care.
 */
export function asString(v: string | string[] | undefined): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim().length > 0);
    return first?.trim();
  }
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function statusFromOpenFda(
  raw: string | undefined,
): ShortageStatus | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "current") return "active";
  if (n === "resolved") return "resolved";
  if (n === "discontinued" || n === "discontinuation") return "discontinuation";
  if (n === "to be discontinued") return "to-be-discontinued";
  return null;
}

export function presentationOf(rec: OpenFdaShortageRecord): string {
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
 * "05/26/2026") into ISO `YYYY-MM-DD`. Falls back to `fallbackDate`
 * (YYYY-MM-DD) when the value is missing or unparseable so the row
 * still passes `z.string().date()` validation.
 */
export function toIsoDate(raw: string | undefined, fallbackDate: string): string {
  if (!raw) return fallbackDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const usFormat = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usFormat) {
    const [, mm, dd, yyyy] = usFormat;
    return `${yyyy}-${mm}-${dd}`;
  }
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return fallbackDate;
  return new Date(ts).toISOString().slice(0, 10);
}

export function hashShortageRecord(rec: OpenFdaShortageRecord): string {
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

/**
 * Pull every candidate join key out of a single openFDA shortage row.
 * `openfda.substance_name` and `openfda.generic_name` are the
 * authoritative canonical forms (uppercased substance only); the
 * top-level `generic_name` is a presentation string that often glues
 * the dosage form onto the name ("Levothyroxine Sodium Tablet") and
 * is unsuitable as a join key on its own.
 */
export function joinCandidates(rec: OpenFdaShortageRecord): string[] {
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

// ────────────────────────────────────────────────────────────────────────
// openFDA paging
// ────────────────────────────────────────────────────────────────────────

export async function fetchAllShortageRecords(
  log: (line: string) => void = () => {},
): Promise<OpenFdaShortageRecord[]> {
  const out: OpenFdaShortageRecord[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * PAGE_LIMIT;
    const url = `${OPENFDA_SHORTAGES_URL}?limit=${PAGE_LIMIT}&skip=${skip}`;
    log(`GET ${url}`);
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
// Crosswalk + entry building
// ────────────────────────────────────────────────────────────────────────

/**
 * Substance / ingredient name (lowercased) → drug slug. Index every
 * drug by name and every component ingredient so a shortage row tagged
 * with the substance name still finds its drug record. Works off plain
 * `(slug, names)` pairs so callers can feed it from the TS seed or
 * from Postgres without dragging full Drug payloads around.
 */
export function buildShortageCrosswalk(
  drugs: Iterable<{ slug: string; names: string[] }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const drug of drugs) {
    for (const name of drug.names) {
      const key = name.trim().toLowerCase();
      if (key) map.set(key, drug.slug);
    }
  }
  return map;
}

export interface BuildShortagesResult {
  bySlug: Map<string, ShortageEntry[]>;
  total: number;
  unmatched: number;
  unknownStatus: number;
}

export function buildShortageEntries(
  records: OpenFdaShortageRecord[],
  crosswalk: Map<string, string>,
  extractedAt: string,
): BuildShortagesResult {
  const bySlug = new Map<string, ShortageEntry[]>();
  let unmatched = 0;
  let unknownStatus = 0;
  const fallbackDate = extractedAt.slice(0, 10);

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

    const provenance: Provenance = {
      sourceUrl: OPENFDA_SHORTAGES_URL,
      sourceHash: hashShortageRecord(rec),
      extractedAt,
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
      fdaUpdatedAt: toIsoDate(asString(rec.update_date), fallbackDate),
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

  const total = [...bySlug.values()].reduce((n, a) => n + a.length, 0);
  return { bySlug, total, unmatched, unknownStatus };
}

/**
 * Content hash over the parts of a shortage dataset that matter for
 * change detection (everything except `extractedAt`, which moves every
 * run by design). Used by the cron route to skip the table rewrite —
 * and the webhook — when upstream hasn't changed.
 */
export function shortageDatasetHash(
  bySlug: Map<string, ShortageEntry[]>,
): string {
  const slugs = [...bySlug.keys()].sort();
  const canonical = slugs.map((slug) => [
    slug,
    bySlug.get(slug)!.map((e) => ({
      status: e.status,
      presentation: e.presentation,
      sponsor: e.sponsor ?? null,
      reason: e.reason ?? null,
      therapeuticCategory: e.therapeuticCategory ?? null,
      fdaUpdatedAt: e.fdaUpdatedAt,
      sourceHash: e.provenance.sourceHash,
    })),
  ]);
  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}
