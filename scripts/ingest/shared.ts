/**
 * scripts/ingest/shared.ts
 *
 * Single source of truth for the Stage-0 drug ingest logic, shared by:
 *
 *   - scripts/ingest/fetch-drugs.ts        (curated ~300-drug TS seed)
 *   - scripts/ingest/fetch-drugs-scale.ts  (5,000+ drug NDJSON dataset)
 *
 * Both pipelines must produce byte-identical records for the same
 * candidate, so every fetcher, text cleaner, and the record builder
 * live here — never duplicated per pipeline.
 *
 * Sources (free, no-auth-required; openFDA optionally keyed):
 *   1. RxNav (NIH)  — IDs, brand names, ingredients, ATC/EPC/MOA/PE classes.
 *   2. openFDA      — label narrative sections, NDC + UNII, approvals.
 *
 * Rate limits are enforced per host so concurrent callers stay polite:
 *   - api.fda.gov: ~2.8 req/s (240/min cap). Without OPENFDA_API_KEY the
 *     daily cap is 1,000 requests — set the key for any scale run.
 *   - rxnav.nlm.nih.gov: ~8 req/s (20 req/s cap).
 */

import { createHash } from "node:crypto";

import {
  DrugClassSchema,
  DrugSchema,
  IngredientSchema,
  type Drug,
  type DrugClass,
  type DrugClassKind,
  type DrugClassRef,
  type Ingredient,
  type Provenance,
} from "../../lib/schemas";
import { icd10ForText } from "../../lib/ingest/icd10";

// Deterministic fixed timestamp so re-runs do not diff just because of clock.
export const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

// ────────────────────────────────────────────────────────────────────────
// Pure utilities
// ────────────────────────────────────────────────────────────────────────

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Strip leading section headers ("12.1 MECHANISM OF ACTION", "1 INDICATIONS
 * AND USAGE", etc.) and collapse whitespace. openFDA labels often prefix the
 * narrative with these markers.
 */
export function cleanLabelText(text: string): string {
  return text
    .replace(/^\s*\d+(\.\d+)*\s+/i, "")
    .replace(
      /^\s*(MECHANISM OF ACTION|INDICATIONS AND USAGE|INDICATIONS|CONTRAINDICATIONS?|PHARMACOKINETICS|CLINICAL PHARMACOLOGY|DOSAGE AND ADMINISTRATION|ADVERSE REACTIONS|WARNINGS AND PRECAUTIONS|WARNINGS AND CAUTIONS|WARNINGS|PRECAUTIONS|USE IN SPECIFIC POPULATIONS|OVERDOSAGE|BOXED WARNING|WARNING:?)[:\s]+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean and hard-cap a label section to `maxLen`, snapping to the last
 * sentence boundary so excerpts don't end mid-word. Unlike
 * `firstSentences`, this keeps as much text as fits — used for the
 * richer reference sections (dosage, adverse reactions, warnings) where
 * a two-sentence summary would be uselessly short.
 */
export function clip(text: string, maxLen: number): string {
  const cleaned = cleanLabelText(text);
  if (!cleaned) return cleaned;
  if (cleaned.length <= maxLen) return cleaned;
  const hardCut = cleaned.slice(0, maxLen);
  const lastPeriod = hardCut.lastIndexOf(". ");
  return (
    lastPeriod > maxLen * 0.5 ? hardCut.slice(0, lastPeriod + 1) : `${hardCut}…`
  ).trim();
}

/**
 * Returns the first 1-2 sentences of `text`, never exceeding `maxLen`. Used to
 * derive a brief `summary` from openFDA's frequently-verbose narrative blocks.
 */
export function firstSentences(text: string, maxLen = 1500): string {
  const cleaned = cleanLabelText(text);
  if (!cleaned) return cleaned;

  const sentenceRe = /[.!?](\s+|$)/g;
  let count = 0;
  let endIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(cleaned)) !== null) {
    count++;
    endIdx = m.index + 1;
    if (count >= 2) break;
  }
  if (endIdx > 0 && endIdx <= maxLen) return cleaned.slice(0, endIdx).trim();
  if (cleaned.length <= maxLen) return cleaned;
  // Hard cap fallback.
  const hardCut = cleaned.slice(0, maxLen);
  const lastPeriod = hardCut.lastIndexOf(". ");
  return (lastPeriod > 200 ? hardCut.slice(0, lastPeriod + 1) : hardCut + "…").trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Clean the openFDA label `drug_interactions` narrative: strip the outer
 * section header and collapse whitespace, but keep inner subsection
 * numbering ("7.1 ACE inhibitors") since it carries meaning. Mirrors
 * scripts/ingest/fetch-interactions.ts so the scale pipeline folds the
 * same text the curated pipeline stores in its separate narrative file.
 */
export function cleanInteractionsNarrative(text: string): string {
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
// HTTP with per-host rate limiting + optional openFDA API key
// ────────────────────────────────────────────────────────────────────────

/**
 * Thrown when openFDA keeps answering 429 after every retry — almost
 * always the no-key 1,000-requests/day cap. Scale runs must abort on
 * this instead of marking thousands of candidates as failed.
 */
export class RateLimitExhaustedError extends Error {
  constructor(url: string) {
    super(
      `rate limit exhausted for ${url} — if this is api.fda.gov, set OPENFDA_API_KEY (free key lifts the 1,000/day cap to 120,000/day)`,
    );
    this.name = "RateLimitExhaustedError";
  }
}

/**
 * openFDA answered 403 API_KEY_INVALID. Subclasses the rate-limit error
 * so it propagates through the same abort path — silently continuing
 * would strip labels from every record in the run.
 */
export class InvalidApiKeyError extends RateLimitExhaustedError {
  constructor(url: string) {
    super(url);
    this.message = `openFDA rejected OPENFDA_API_KEY (API_KEY_INVALID) for ${url.split("?")[0]} — check the key in .env`;
    this.name = "InvalidApiKeyError";
  }
}

/** Minimum interval between requests, per host. */
const HOST_MIN_INTERVAL_MS: Record<string, number> = {
  "api.fda.gov": 350,
  "rxnav.nlm.nih.gov": 125,
};

const hostQueue = new Map<string, Promise<void>>();
const hostLastAt = new Map<string, number>();
const hostCooldownUntil = new Map<string, number>();

/**
 * Serialize request spacing per host (concurrency-safe). A 429 from a
 * host installs a shared cooldown so every worker eases off together
 * instead of each one independently re-triggering the throttle.
 */
function throttleHost(host: string): Promise<void> {
  const interval = HOST_MIN_INTERVAL_MS[host];
  if (!interval) return Promise.resolve();
  const prev = hostQueue.get(host) ?? Promise.resolve();
  const next = prev.then(async () => {
    const last = hostLastAt.get(host) ?? 0;
    const cooldown = hostCooldownUntil.get(host) ?? 0;
    const wait = Math.max(last + interval, cooldown) - Date.now();
    if (wait > 0) await sleep(wait);
    hostLastAt.set(host, Date.now());
  });
  hostQueue.set(host, next);
  return next;
}

function noteRateLimited(host: string, attempt: number): void {
  // 5s, 10s, 20s, 40s, 80s, 160s — long enough to ride out a
  // per-minute window without burning the request budget.
  const backoff = 5_000 * 2 ** Math.min(attempt, 5);
  const until = Date.now() + backoff;
  if (until > (hostCooldownUntil.get(host) ?? 0)) {
    hostCooldownUntil.set(host, until);
  }
}

/** Append the openFDA API key when configured. Never logged. */
function withApiKey(url: string): string {
  const key = process.env.OPENFDA_API_KEY;
  if (!key || !url.startsWith("https://api.fda.gov/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
}

const MAX_429_RETRIES = 6;

export async function fetchJson(url: string, retries = 3): Promise<any> {
  const host = new URL(url).host;
  let lastErr: unknown = null;
  let errorAttempts = 0;
  let rateLimitAttempts = 0;
  while (true) {
    try {
      await throttleHost(host);
      const res = await fetch(withApiKey(url), {
        headers: { "User-Agent": "pharmacopeia-ingest/1.0 (+local dev)" },
      });
      if (res.status === 404) return null;
      if (res.status === 403 && host === "api.fda.gov" && process.env.OPENFDA_API_KEY) {
        throw new InvalidApiKeyError(url);
      }
      if (res.status === 429) {
        // Budgeted separately from real errors: a 429 burst is normal
        // upstream behaviour during a long run. The shared host
        // cooldown makes every worker back off, and the exponential
        // budget (~5 min total) rides out per-minute windows. Only a
        // *sustained* wall of 429s — the no-key daily cap — exhausts it.
        if (rateLimitAttempts >= MAX_429_RETRIES) {
          throw new RateLimitExhaustedError(url);
        }
        noteRateLimited(host, rateLimitAttempts);
        rateLimitAttempts++;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      if (e instanceof RateLimitExhaustedError) throw e;
      lastErr = e;
      if (errorAttempts >= retries) break;
      errorAttempts++;
      await sleep(500 * errorAttempts);
    }
  }
  throw lastErr ?? new Error(`fetch failed: ${url}`);
}

export function makeProv(
  sourceUrl: string,
  responseForHash: unknown,
  extractor: Provenance["extractor"],
  confidence: number,
): Provenance {
  const hashBasis =
    typeof responseForHash === "string"
      ? responseForHash
      : JSON.stringify(responseForHash ?? sourceUrl);
  return {
    sourceUrl,
    sourceHash: sha256(hashBasis).slice(0, 64),
    extractedAt: EXTRACTED_AT,
    extractor,
    confidence,
  };
}

// ────────────────────────────────────────────────────────────────────────
// RxNav lookups
// ────────────────────────────────────────────────────────────────────────

export interface RxNavSummary {
  rxcui: string;
  name: string;
  synonyms: string[];
  brands: string[];
  classRefs: DrugClassRef[];
  classRecords: DrugClass[];
  atcCodes: string[];
}

export async function fetchRxNavSummary(
  name: string,
  knownRxcui?: string,
): Promise<RxNavSummary | null> {
  let rxcui = knownRxcui;
  if (!rxcui) {
    const idUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=2`;
    const idResp = await fetchJson(idUrl);
    rxcui = idResp?.idGroup?.rxnormId?.[0];
  }
  if (!rxcui) return null;

  const propsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
  const propsResp = await fetchJson(propsUrl);
  const props = propsResp?.properties;
  if (!props) return null;
  const canonicalName = titleCase(props.name ?? name);
  const synonyms = props.synonym ? [props.synonym] : [];

  // brand names containing this ingredient
  const brandsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN`;
  const brandsResp = await fetchJson(brandsUrl);
  const brandGroups = brandsResp?.relatedGroup?.conceptGroup ?? [];
  const brandSet = new Set<string>();
  for (const g of brandGroups) {
    if (g.tty !== "BN") continue;
    for (const c of g.conceptProperties ?? []) {
      if (c?.name) brandSet.add(c.name);
    }
  }
  const brands = Array.from(brandSet).sort();

  // classes
  const classUrl = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${rxcui}`;
  const classResp = await fetchJson(classUrl);
  const classList = classResp?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];

  const classRefs: DrugClassRef[] = [];
  const classRecords: DrugClass[] = [];
  const seenRefs = new Set<string>();

  for (const item of classList) {
    const min = item?.minConcept;
    // only look at the ingredient (IN) row to avoid combination-product noise
    if (!min || (min.tty !== "IN" && min.tty !== "PIN")) continue;
    if (min.rxcui !== rxcui) continue;

    const concept = item?.rxclassMinConceptItem;
    if (!concept?.classId || !concept?.className) continue;

    const classType: string = concept.classType ?? "";
    const kind = mapClassType(classType);
    if (!kind) continue;

    const slug = slugify(concept.className);
    if (!slug) continue;

    const key = `${kind}:${slug}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);

    classRefs.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
    });

    const classProv = makeProv(
      `https://rxnav.nlm.nih.gov/REST/rxclass/class/byId.json?classId=${concept.classId}`,
      { classId: concept.classId, className: concept.className, kind },
      "rxclass",
      0.95,
    );

    classRecords.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
      parent: null,
      drugCount: 0,
      provenance: classProv,
    });
  }

  classRefs.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  classRecords.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));

  const atcCodes = Array.from(
    new Set(
      classRefs
        .filter((c) => c.kind === "atc" && c.code)
        .map((c) => c.code as string),
    ),
  ).sort();

  return {
    rxcui,
    name: canonicalName,
    synonyms,
    brands,
    classRefs,
    classRecords,
    atcCodes,
  };
}

export function mapClassType(classType: string): DrugClassKind | null {
  switch (classType) {
    case "ATC1-4":
    case "ATC":
      return "atc";
    case "EPC":
      return "epc";
    case "MOA":
      return "moa";
    case "PE":
      return "pe";
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// openFDA label lookup
// ────────────────────────────────────────────────────────────────────────

export interface OpenFdaLabel {
  url: string;
  raw: any;
}

export async function fetchOpenFdaLabel(name: string): Promise<OpenFdaLabel | null> {
  // Fetch up to 50 candidate labels and pick the first one whose generic_name
  // is mono-substance. Combination products (e.g. "SITAGLIPTIN AND METFORMIN
  // HYDROCHLORIDE") are rejected so we get the FDA label for the single drug.
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/label.json?search=${search}&limit=50`;
  const resp = await fetchJson(url);
  const results: any[] = resp?.results ?? [];
  if (!results.length) return null;

  const upper = name.toUpperCase();
  const SALT_SUFFIXES = [
    "HYDROCHLORIDE",
    "HCL",
    "SODIUM",
    "POTASSIUM",
    "CALCIUM",
    "SULFATE",
    "SUCCINATE",
    "TARTRATE",
    "MALEATE",
    "FUMARATE",
    "CITRATE",
    "PHOSPHATE",
    "BESYLATE",
    "MESYLATE",
    "ACETATE",
    "BROMIDE",
    "CHLORIDE",
    "BITARTRATE",
  ];

  function isMonoMatch(gnList: string[]): boolean {
    if (gnList.length !== 1) return false;
    const single = (gnList[0] ?? "").toUpperCase().trim();
    if (!single) return false;
    // reject anything that smells like a combination product
    if (/\bAND\b|\bWITH\b|[,/;+]/.test(single)) return false;
    if (single === upper) return true;
    // allow "<NAME> HYDROCHLORIDE", "<NAME> SODIUM" etc.
    const tokens = single.split(/\s+/);
    if (tokens.length === 1 && tokens[0] === upper) return true;
    if (tokens.length === 2 && tokens[0] === upper && SALT_SUFFIXES.includes(tokens[1]))
      return true;
    // some ingredients are themselves multi-word (e.g. "FLUTICASONE PROPIONATE")
    if (tokens[0] === upper && tokens.slice(1).every((t) => SALT_SUFFIXES.includes(t)))
      return true;
    return false;
  }

  const monoMatch = results.find((r) =>
    isMonoMatch(r?.openfda?.generic_name ?? []),
  );

  if (!monoMatch) {
    // fall back to the first result whose generic_name contains the search term
    const loose = results.find((r) => {
      const gn: string[] = r?.openfda?.generic_name ?? [];
      return gn.some((g) => (g ?? "").toUpperCase().includes(upper));
    });
    if (!loose) return null;
    return { url, raw: loose };
  }
  return { url, raw: monoMatch };
}

// ────────────────────────────────────────────────────────────────────────
// openFDA drugsfda approval history
// ────────────────────────────────────────────────────────────────────────

export interface ApprovalEntry {
  date: string; // YYYY-MM-DD
  applicationNumber: string;
  type: "NDA" | "ANDA" | "BLA" | "OTC";
  sponsor?: string;
}

function applicationType(appNo: string): ApprovalEntry["type"] | null {
  const up = appNo.toUpperCase();
  if (up.startsWith("NDA")) return "NDA";
  if (up.startsWith("ANDA")) return "ANDA";
  if (up.startsWith("BLA")) return "BLA";
  if (up.startsWith("OTC")) return "OTC";
  return null;
}

function fdaDateToIso(yyyymmdd: string): string | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const iso = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : iso;
}

/**
 * Pull original-approval records from openFDA's drugsfda endpoint. We
 * keep one entry per application (the original "ORIG/1" approval), tag
 * it by application type, and cap the list so a generic with hundreds of
 * ANDAs doesn't bloat the record. NDA/BLA originals are prioritised over
 * generic ANDAs since they carry the more interesting approval dates.
 */
export async function fetchApprovalHistory(name: string): Promise<ApprovalEntry[]> {
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${search}&limit=100`;
  const resp = await fetchJson(url).catch((e) => {
    if (e instanceof RateLimitExhaustedError) throw e;
    return null;
  });
  const results: any[] = resp?.results ?? [];
  if (!results.length) return [];

  const entries: ApprovalEntry[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const appNo: string | undefined = r?.application_number;
    if (!appNo || seen.has(appNo)) continue;
    const type = applicationType(appNo);
    if (!type) continue;

    const submissions: any[] = r?.submissions ?? [];
    const orig = submissions.find(
      (s) =>
        (s?.submission_type ?? "").toUpperCase() === "ORIG" &&
        String(s?.submission_number ?? "") === "1" &&
        (s?.submission_status ?? "").toUpperCase() === "AP",
    );
    const iso = orig?.submission_status_date
      ? fdaDateToIso(String(orig.submission_status_date))
      : null;
    if (!iso) continue;

    seen.add(appNo);
    const sponsor: string | undefined = r?.sponsor_name
      ? titleCase(String(r.sponsor_name))
      : undefined;
    entries.push({ date: iso, applicationNumber: appNo, type, sponsor });
  }

  // Prioritise innovator applications, then oldest-first within the cap.
  const rank: Record<ApprovalEntry["type"], number> = {
    BLA: 0,
    NDA: 1,
    OTC: 2,
    ANDA: 3,
  };
  entries.sort(
    (a, b) => rank[a.type] - rank[b.type] || a.date.localeCompare(b.date),
  );
  const capped = entries.slice(0, 8);
  // Present chronologically for the UI.
  capped.sort((a, b) => a.date.localeCompare(b.date));
  return capped;
}

// ────────────────────────────────────────────────────────────────────────
// Mechanism targets (derived from MOA class names)
// ────────────────────────────────────────────────────────────────────────

const MOA_SUFFIXES = [
  "inhibitors",
  "inhibitor",
  "agonists",
  "agonist",
  "antagonists",
  "antagonist",
  "blockers",
  "blocker",
  "modulators",
  "modulator",
  "activators",
  "activator",
  "stimulants",
  "stimulant",
  "agents",
  "agent",
  "reuptake inhibitors",
];

/**
 * Derive plausible molecular/process targets from a drug's MOA-kind
 * RxClass names by stripping the trailing mechanism word. E.g.
 * "HMG-CoA Reductase Inhibitors" → "HMG-CoA Reductase". Conservative:
 * a class only contributes a target when it ends in a known mechanism
 * suffix, so we don't emit garbage.
 */
export function deriveTargets(moaClassNames: string[]): string[] {
  const targets = new Set<string>();
  for (const raw of moaClassNames) {
    const name = raw.trim();
    const lower = name.toLowerCase();
    const suffix = MOA_SUFFIXES.find((s) => lower.endsWith(` ${s}`));
    if (!suffix) continue;
    const stripped = name.slice(0, name.length - suffix.length).trim();
    if (stripped.length >= 3) targets.add(stripped);
  }
  return Array.from(targets).sort();
}

// ────────────────────────────────────────────────────────────────────────
// Per-drug record builder
// ────────────────────────────────────────────────────────────────────────

export interface CoverageBits {
  mechanism: boolean;
  targets: boolean;
  indications: boolean;
  contraindications: boolean;
  pharmacokinetics: boolean;
  boxedWarning: boolean;
  dosageNarrative: boolean;
  adverseReactions: boolean;
  approvalHistory: boolean;
  atc: boolean;
  brands: boolean;
  label: boolean;
}

export const COVERAGE_KEYS: ReadonlyArray<keyof CoverageBits> = [
  "mechanism",
  "targets",
  "indications",
  "contraindications",
  "pharmacokinetics",
  "boxedWarning",
  "dosageNarrative",
  "adverseReactions",
  "approvalHistory",
  "atc",
  "brands",
  "label",
];

export interface BuiltDrug {
  drug: Drug;
  ingredient: Ingredient;
  classes: DrugClass[];
  coverage: CoverageBits;
}

/**
 * Assemble a validated Drug + Ingredient + class records from the three
 * upstream payloads. Pure given its inputs — no network, no clock — so
 * both ingest pipelines build identical records. Throws if the assembled
 * record fails Zod validation.
 */
export interface BuildOptions {
  /**
   * Fold the label's cleaned `drug_interactions` narrative into
   * `drug.interactionsNarrative`. The curated TS-seed pipeline keeps
   * narratives in a separate seed file for bundle-size reasons (and
   * folds them in at db-seed time); the scale pipeline embeds them
   * directly since NDJSON artifacts never ship in the bundle.
   */
  includeInteractionsNarrative?: boolean;
}

export function buildDrugRecord(
  name: string,
  rx: RxNavSummary,
  label: OpenFdaLabel | null,
  approvalHistory: ApprovalEntry[],
  options: BuildOptions = {},
): BuiltDrug {
  const slug = slugify(name);

  // narrative fields
  const mechRaw: string | undefined = label?.raw?.mechanism_of_action?.[0];
  const indRaw: string | undefined = label?.raw?.indications_and_usage?.[0];
  const ciRaw: string | undefined = label?.raw?.contraindications?.[0];
  const pkRaw: string | undefined = label?.raw?.pharmacokinetics?.[0];

  // targets + a fallback summary derived from the drug's MOA-kind classes.
  const moaClassNames = rx.classRefs
    .filter((c) => c.kind === "moa")
    .map((c) => c.name);
  const moaTargets = deriveTargets(moaClassNames);

  const mechanism = mechRaw
    ? { summary: firstSentences(mechRaw, 1500), targets: moaTargets }
    : moaClassNames.length > 0
      ? {
          summary: `Mechanism-of-action class${moaClassNames.length > 1 ? "es" : ""}: ${moaClassNames.join("; ")}.`,
          targets: moaTargets,
        }
      : undefined;
  const indications = indRaw
    ? (() => {
        const text = firstSentences(indRaw, 1200);
        return [{ text, icd10: icd10ForText(text), snomed: [] as string[] }];
      })()
    : [];
  const contraindications = ciRaw
    ? [{ text: firstSentences(ciRaw, 1200), severity: "contraindicated" as const }]
    : [];
  const pharmacokinetics = pkRaw ? { metabolism: firstSentences(pkRaw, 600) } : undefined;

  // Verbatim FDA label narrative sections (reference excerpts).
  const boxedRaw: string | undefined = label?.raw?.boxed_warning?.[0];
  const dosageRaw: string | undefined = label?.raw?.dosage_and_administration?.[0];
  const warningsRaw: string | undefined =
    label?.raw?.warnings_and_cautions?.[0] ?? label?.raw?.warnings?.[0];
  const adverseRaw: string | undefined = label?.raw?.adverse_reactions?.[0];
  const populationsRaw: string | undefined =
    label?.raw?.use_in_specific_populations?.[0] ?? label?.raw?.pregnancy?.[0];
  const overdoseRaw: string | undefined = label?.raw?.overdosage?.[0];

  const labelSections = {
    boxedWarning: boxedRaw ? clip(boxedRaw, 1400) : undefined,
    dosageAndAdministration: dosageRaw ? clip(dosageRaw, 1600) : undefined,
    warningsAndPrecautions: warningsRaw ? clip(warningsRaw, 1600) : undefined,
    adverseReactions: adverseRaw ? clip(adverseRaw, 1600) : undefined,
    useInSpecificPopulations: populationsRaw ? clip(populationsRaw, 1400) : undefined,
    overdosage: overdoseRaw ? clip(overdoseRaw, 1200) : undefined,
  };
  const hasLabelSections = Object.values(labelSections).some(Boolean);

  // openFDA identifier block (NDC list + UNII)
  const ndc = Array.from(
    new Set<string>((label?.raw?.openfda?.product_ndc ?? []) as string[]),
  )
    .sort()
    .slice(0, 8);
  const unii: string | undefined = label?.raw?.openfda?.unii?.[0];

  // ingredient (1:1 with drug for v0)
  const ingredientProv = makeProv(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
    { rxcui: rx.rxcui, name: rx.name },
    "rxnorm",
    0.95,
  );
  const ingredient: Ingredient = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    rxcui: rx.rxcui,
    drugCount: 1,
    provenance: ingredientProv,
  };

  // drug provenance: openFDA when label found, else RxNav
  const drugProv: Provenance = label
    ? {
        sourceUrl: label.url,
        sourceHash: sha256(JSON.stringify(label.raw)).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "openfda",
        confidence: 0.85,
      }
    : {
        sourceUrl: `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
        sourceHash: sha256(`rxnav:${rx.rxcui}:${rx.name}`).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "rxnorm",
        confidence: 0.95,
      };

  const interactionsRaw: string | undefined = label?.raw?.drug_interactions?.[0];
  const interactionsNarrative =
    options.includeInteractionsNarrative && interactionsRaw?.trim()
      ? cleanInteractionsNarrative(interactionsRaw) || undefined
      : undefined;

  const drug: Drug = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    jurisdiction: "US-FDA",
    ingredients: [{ slug, name: rx.name }],
    brands: rx.brands.slice(0, 12),
    classes: rx.classRefs,
    mechanism,
    indications,
    contraindications,
    dosing: [],
    pharmacokinetics,
    approvalHistory,
    interactionsNarrative,
    labelSections: hasLabelSections ? labelSections : undefined,
    identifiers: {
      rxcui: rx.rxcui,
      ndc,
      atc: rx.atcCodes,
      unii,
    },
    provenance: drugProv,
  };

  DrugSchema.parse(drug);
  IngredientSchema.parse(ingredient);
  rx.classRecords.forEach((c) => DrugClassSchema.parse(c));

  const coverage: CoverageBits = {
    mechanism: !!mechanism,
    targets: moaTargets.length > 0,
    indications: indications.length > 0,
    contraindications: contraindications.length > 0,
    pharmacokinetics: !!pharmacokinetics,
    boxedWarning: !!labelSections.boxedWarning,
    dosageNarrative: !!labelSections.dosageAndAdministration,
    adverseReactions: !!labelSections.adverseReactions,
    approvalHistory: approvalHistory.length > 0,
    atc: rx.atcCodes.length > 0,
    brands: rx.brands.length > 0,
    label: !!label,
  };

  return { drug, ingredient, classes: rx.classRecords, coverage };
}

/**
 * Resolve a single candidate end-to-end against all three upstreams and
 * build its record. `knownRxcui` skips the name→rxcui lookup when the
 * universe already carries it (the scale pipeline does). Returns null
 * when RxNav cannot resolve the candidate at all.
 */
export async function ingestCandidate(
  name: string,
  knownRxcui?: string,
  options: BuildOptions = {},
): Promise<BuiltDrug | null> {
  const rx = await fetchRxNavSummary(name, knownRxcui);
  if (!rx) return null;

  const label = await fetchOpenFdaLabel(name).catch((e) => {
    if (e instanceof RateLimitExhaustedError) throw e;
    return null;
  });
  const approvalHistory = await fetchApprovalHistory(name).catch((e) => {
    if (e instanceof RateLimitExhaustedError) throw e;
    return [];
  });

  return buildDrugRecord(name, rx, label, approvalHistory, options);
}

// ────────────────────────────────────────────────────────────────────────
// Dataset finalisation (shared by both pipelines)
// ────────────────────────────────────────────────────────────────────────

export interface FinalizedDataset {
  drugs: Drug[];
  ingredients: Ingredient[];
  classes: DrugClass[];
}

/**
 * Turn per-drug ingest results into a coherent dataset:
 *
 *  - aggregate class records across drugs (drugCount per class),
 *  - kind-qualify colliding class slugs (e.g. "proton-pump-inhibitors"
 *    appearing as both ATC and MOA becomes "...-atc" / "...-moa") and
 *    propagate the rewrites into every drug's class refs,
 *  - sort everything deterministically,
 *  - re-validate every record after the rewrites.
 *
 * Pure: same inputs always produce the same dataset, regardless of
 * which pipeline (curated TS seed or NDJSON scale) collected them.
 */
export function finalizeDataset(
  results: Array<Pick<BuiltDrug, "drug" | "ingredient" | "classes">>,
): FinalizedDataset {
  const drugs = results.map((r) => r.drug);
  const ingredients = results.map((r) => r.ingredient);

  const classMap = new Map<string, DrugClass>(); // key = `${kind}:${slug}`
  for (const r of results) {
    for (const c of r.classes) {
      const key = `${c.kind}:${c.slug}`;
      const existing = classMap.get(key);
      if (existing) {
        existing.drugCount += 1;
      } else {
        classMap.set(key, { ...c, drugCount: 1 });
      }
    }
  }

  // Slug collision fix: when the same slugified name appears under multiple
  // class kinds, make every colliding entry's slug kind-qualified so the
  // by-slug map and the UI keys stay unique.
  const slugGroups = new Map<string, DrugClass[]>();
  for (const c of classMap.values()) {
    const list = slugGroups.get(c.slug) ?? [];
    list.push(c);
    slugGroups.set(c.slug, list);
  }
  const slugRewrites = new Map<string, string>(); // `${kind}:${oldSlug}` -> newSlug
  for (const [slug, group] of slugGroups) {
    if (group.length <= 1) continue;
    for (const c of group) {
      const newSlug = `${slug}-${c.kind}`;
      slugRewrites.set(`${c.kind}:${slug}`, newSlug);
      c.slug = newSlug;
    }
  }
  for (const d of drugs) {
    d.classes = d.classes.map((ref) => {
      const newSlug = slugRewrites.get(`${ref.kind}:${ref.slug}`);
      return newSlug ? { ...ref, slug: newSlug } : ref;
    });
  }

  // Deterministic order
  drugs.sort((a, b) => a.slug.localeCompare(b.slug));
  for (const d of drugs) {
    d.classes.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  }
  ingredients.sort((a, b) => a.slug.localeCompare(b.slug));
  const classes = Array.from(classMap.values()).sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug),
  );

  // Re-validate after rewrites to make sure we did not break anything.
  for (const d of drugs) DrugSchema.parse(d);
  for (const c of classes) DrugClassSchema.parse(c);
  for (const i of ingredients) IngredientSchema.parse(i);

  return { drugs, ingredients, classes };
}