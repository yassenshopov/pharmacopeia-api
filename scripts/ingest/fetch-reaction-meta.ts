/**
 * scripts/ingest/fetch-reaction-meta.ts
 *
 * Crosswalks every canonical reaction (MedDRA Preferred Term derived
 * from `SEED_ADVERSE_EVENTS`) to NLM MeSH metadata + a curated set of
 * PubMed references via the NCBI E-utilities API.
 *
 * Why this exists:
 *   The reactions surface needs reference content — definitions and
 *   citations — without drifting into symptom-checker territory. We
 *   never author our own definitions; we mirror the NLM MeSH scope
 *   note (librarian-written) and link out for everything else.
 *
 * Strategy per reaction:
 *   1. esearch `mesh` with `<name>[mh]` to restrict to records whose
 *      canonical descriptor name is the reaction. Try the canonical
 *      reaction name first; fall back to its alias (the American
 *      spelling for British MedDRA terms — MeSH uses American spelling
 *      predominantly, so the alias often matches when the canonical
 *      doesn't).
 *   2. esummary `mesh` for the descriptor UID — yields D-number, scope
 *      note, MeSH terms, tree numbers, and the parent UID for each
 *      tree position.
 *   3. esearch `pubmed` with the canonical MeSH descriptor name as
 *      Major Topic, sorted by pub date desc; esummary the top-N PMIDs.
 *
 * After every reaction is processed, a single batched esummary call
 * resolves all unique parent UIDs to their MeSH descriptor names so
 * the public record carries human-readable parent names, not just IDs.
 *
 * Idempotent: deterministic provenance.extractedAt, sorted output,
 * stable hashing. Re-runs against an unchanged MeSH/PubMed index
 * produce byte-identical files.
 *
 * Tunables (env):
 *   REACTION_META_TOP_N   max PubMed references per reaction (default 6, max 25)
 *   REACTION_META_LIMIT   max reactions to process (default 0 = all)
 *   REACTION_META_THROTTLE_MS  delay between requests (default
 *                              350ms unkeyed, 110ms with NCBI_API_KEY)
 *   NCBI_API_KEY               NCBI API key for higher rate limit
 *   NCBI_EMAIL                 contact email NCBI requests in `tool=` param
 *
 * Run: npm run ingest:reaction-meta
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LiteratureReferenceSchema,
  ReactionMetaSchema,
  type LiteratureReference,
  type MeshTreeNode,
  type Provenance,
  type ReactionMeta,
} from "../../lib/schemas";
import { getReactionIndex } from "../../lib/data/reactions-index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_FILE = resolve(REPO_ROOT, "lib/data/seed/reaction-meta.ts");

const EXTRACTED_AT = "2026-05-29T00:00:00.000Z";

const TOP_N = clampInt(process.env.REACTION_META_TOP_N, 6, 1, 25);
const LIMIT = clampInt(process.env.REACTION_META_LIMIT, 0, 0, 10_000);
const THROTTLE_MS = clampInt(
  process.env.REACTION_META_THROTTLE_MS,
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

// ────────────────────────────────────────────────────────────────────────
// E-utilities response shapes
// ────────────────────────────────────────────────────────────────────────

interface ESearchResponse {
  esearchresult?: {
    count?: string;
    idlist?: string[];
  };
}

interface ESummaryArticleId {
  idtype?: string;
  value?: string;
}

interface MeshIdxLink {
  parent?: number | string;
  treenum?: string;
}

interface MeshSummary {
  uid?: string;
  ds_meshui?: string;
  ds_meshterms?: string[];
  ds_scopenote?: string;
  ds_idxlinks?: MeshIdxLink[];
}

interface PubmedSummary {
  uid?: string;
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  authors?: Array<{ name?: string }>;
  articleids?: ESummaryArticleId[];
}

interface ESummaryResponse<T> {
  result?: Record<string, T | string[] | undefined> & { uids?: string[] };
}

// ────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────
// MeSH lookups
// ────────────────────────────────────────────────────────────────────────

/**
 * Strip "Subheading" qualifiers from a MeSH descriptor name. esummary
 * may return entries like "Pain/drug therapy" — the trailing slash
 * fragment is a subheading, not part of the canonical descriptor name.
 */
function normaliseDescriptorName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(0, slash).trim() : name.trim();
}

async function findDescriptorUid(name: string): Promise<string | null> {
  const url = buildUrl("esearch.fcgi", {
    ...commonParams(),
    db: "mesh",
    term: `${name}[mh]`,
    retmax: "1",
  });
  const body = await fetchJson<ESearchResponse>(url);
  const id = body?.esearchresult?.idlist?.[0];
  return id ?? null;
}

async function summariseMeshDescriptor(uid: string): Promise<MeshSummary | null> {
  const url = buildUrl("esummary.fcgi", {
    ...commonParams(),
    db: "mesh",
    id: uid,
  });
  const body = await fetchJson<ESummaryResponse<MeshSummary>>(url);
  const result = body?.result;
  if (!result) return null;
  const entry = result[uid];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  return entry;
}

async function summariseMeshParents(
  uids: string[],
): Promise<Map<string, { name: string; descriptorId: string | null }>> {
  const out = new Map<string, { name: string; descriptorId: string | null }>();
  if (uids.length === 0) return out;
  // esummary supports comma-separated ids; batch in chunks of 50 to
  // stay well under the URL-length and per-request limits.
  const BATCH = 50;
  for (let i = 0; i < uids.length; i += BATCH) {
    const batch = uids.slice(i, i + BATCH);
    const url = buildUrl("esummary.fcgi", {
      ...commonParams(),
      db: "mesh",
      id: batch.join(","),
    });
    const body = await fetchJson<ESummaryResponse<MeshSummary>>(url);
    const result = body?.result;
    if (!result) {
      await sleep(THROTTLE_MS);
      continue;
    }
    for (const uid of batch) {
      const entry = result[uid];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const headings = (entry.ds_meshterms ?? []).map(normaliseDescriptorName);
      const headingName = headings[0]?.trim();
      const descriptorId = entry.ds_meshui?.trim() ?? null;
      if (headingName) {
        out.set(uid, { name: headingName, descriptorId });
      }
    }
    await sleep(THROTTLE_MS);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// PubMed lookups (mirror fetch-literature.ts so behaviour stays uniform)
// ────────────────────────────────────────────────────────────────────────

async function searchPmids(meshName: string): Promise<string[]> {
  const url = buildUrl("esearch.fcgi", {
    ...commonParams(),
    db: "pubmed",
    term: `${meshName}[MeSH Major Topic]`,
    retmax: String(TOP_N),
    sort: "pub+date",
  });
  const body = await fetchJson<ESearchResponse>(url);
  return body?.esearchresult?.idlist ?? [];
}

async function summarisePmids(pmids: string[]): Promise<PubmedSummary[]> {
  if (pmids.length === 0) return [];
  const url = buildUrl("esummary.fcgi", {
    ...commonParams(),
    db: "pubmed",
    id: pmids.join(","),
  });
  const body = await fetchJson<ESummaryResponse<PubmedSummary>>(url);
  const result = body?.result;
  if (!result) return [];
  const uids = (result.uids as string[] | undefined) ?? pmids;
  const out: PubmedSummary[] = [];
  for (const uid of uids) {
    const item = result[uid];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      out.push(item as PubmedSummary);
    }
  }
  return out;
}

function extractYear(pubdate: string | undefined): number | null {
  if (!pubdate) return null;
  const m = pubdate.match(/\b(\d{4})\b/);
  if (!m) return null;
  const year = Number.parseInt(m[1], 10);
  return Number.isFinite(year) ? year : null;
}

function pickDoi(ids: ESummaryArticleId[] | undefined): string | undefined {
  if (!ids) return undefined;
  for (const id of ids) {
    if (id.idtype?.toLowerCase() === "doi" && id.value) return id.value;
  }
  return undefined;
}

function toReference(summary: PubmedSummary): LiteratureReference | null {
  const pmid = summary.uid;
  const title = summary.title?.trim();
  const journal = summary.fulljournalname?.trim() || summary.source?.trim();
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

// ────────────────────────────────────────────────────────────────────────
// Build
// ────────────────────────────────────────────────────────────────────────

interface PartialMeta {
  slug: string;
  meshUid: string;
  meshDescriptorId: string;
  meshDescriptorName: string;
  meshEntryTerms: string[];
  scopeNote: string;
  treeNumbers: string[];
  /** parent UID → treeNumber association (resolved later). */
  parentUids: string[];
  references: LiteratureReference[];
}

function buildProvenance(
  meshName: string,
  meshUid: string,
  pmids: string[],
): Provenance {
  const sourceUrl = `https://www.ncbi.nlm.nih.gov/mesh/${meshUid}`;
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({ mesh: meshName, uid: meshUid, pmids }))
    .digest("hex");
  return {
    sourceUrl,
    sourceHash,
    extractedAt: EXTRACTED_AT,
    extractor: "ncbi-eutils-mesh",
    confidence: 0.9,
  };
}

function emitSeed(map: Map<string, ReactionMeta>): string {
  const slugs = [...map.keys()].sort();
  const blocks = slugs.map((slug) => {
    const meta = map.get(slug)!;
    const refs = meta.references
      .map((r) => {
        const fields = [
          `        pmid: ${JSON.stringify(r.pmid)},`,
          `        title: ${JSON.stringify(r.title)},`,
          `        journal: ${JSON.stringify(r.journal)},`,
          `        year: ${r.year},`,
          `        authors: ${JSON.stringify(r.authors)},`,
        ];
        if (r.doi) fields.push(`        doi: ${JSON.stringify(r.doi)},`);
        fields.push(`        pubmedUrl: ${JSON.stringify(r.pubmedUrl)},`);
        return `      {\n${fields.join("\n")}\n      },`;
      })
      .join("\n");

    const parents = meta.parents
      .map(
        (p) =>
          `      { uid: ${JSON.stringify(p.uid)}, descriptorId: ${JSON.stringify(
            p.descriptorId,
          )}, name: ${JSON.stringify(p.name)} },`,
      )
      .join("\n");

    return [
      `  ${JSON.stringify(slug)}: {`,
      `    meshDescriptorId: ${JSON.stringify(meta.meshDescriptorId)},`,
      `    meshUid: ${JSON.stringify(meta.meshUid)},`,
      `    meshDescriptorName: ${JSON.stringify(meta.meshDescriptorName)},`,
      `    meshEntryTerms: ${JSON.stringify(meta.meshEntryTerms)},`,
      `    scopeNote: ${JSON.stringify(meta.scopeNote)},`,
      `    treeNumbers: ${JSON.stringify(meta.treeNumbers)},`,
      `    parents: [`,
      parents,
      `    ],`,
      `    meshBrowserUrl: ${JSON.stringify(meta.meshBrowserUrl)},`,
      `    references: [`,
      refs,
      `    ],`,
      `    provenance: {`,
      `      sourceUrl: ${JSON.stringify(meta.provenance.sourceUrl)},`,
      `      sourceHash: ${JSON.stringify(meta.provenance.sourceHash)},`,
      `      extractedAt: ${JSON.stringify(meta.provenance.extractedAt)},`,
      `      extractor: ${JSON.stringify(meta.provenance.extractor)},`,
      `      confidence: ${meta.provenance.confidence},`,
      `    },`,
      `  },`,
    ].join("\n");
  });

  return `// AUTO-GENERATED by scripts/ingest/fetch-reaction-meta.ts
// Source: NCBI E-utilities — MeSH database (esearch + esummary) and
// PubMed (esearch + esummary on the reaction as a MeSH major topic).
// Do not edit by hand; re-run \`npm run ingest:reaction-meta\` to refresh.
//
// pharmacopeia never authors its own clinical definitions. Every
// \`scopeNote\` below is a verbatim quote from NLM librarians, every
// \`references\` entry is a PubMed record indexed under the matching
// MeSH descriptor. Records that lack a MeSH match (administrative
// MedDRA terms like "Drug Ineffective" or "Off Label Use") are simply
// absent from this map — the API surfaces \`meta: null\` for them.

import type { ReactionMeta } from "@/lib/schemas";

/**
 * Reaction reference metadata keyed by the canonical reaction slug
 * (the same slug produced by \`slugifyReactionName\`). An empty map
 * means the ingest script hasn't been run yet; the reactions surface
 * still functions, every record just reports \`meta: null\`.
 */
export const SEED_REACTION_META: Record<string, ReactionMeta> = {
${blocks.join("\n")}
};

export function getSeedReactionMeta(slug: string): ReactionMeta | null {
  return SEED_REACTION_META[slug] ?? null;
}
`;
}

async function main(): Promise<void> {
  const index = getReactionIndex();
  let reactions = [...index.reactions.values()].sort((a, b) =>
    b.totalReports !== a.totalReports
      ? b.totalReports - a.totalReports
      : a.name.localeCompare(b.name),
  );
  if (LIMIT > 0) reactions = reactions.slice(0, LIMIT);

  process.stderr.write(
    `[fetch-reaction-meta] indexing ${reactions.length} reactions ` +
      `(topN=${TOP_N}, throttle=${THROTTLE_MS}ms${NCBI_KEY ? ", api_key set" : ""})\n`,
  );

  const partial: PartialMeta[] = [];
  let withMatch = 0;
  let withRefs = 0;
  let processed = 0;

  for (const reaction of reactions) {
    processed += 1;
    const candidates = [reaction.name, ...reaction.aliases];

    let uid: string | null = null;
    let usedQuery = "";
    for (const candidate of candidates) {
      uid = await findDescriptorUid(candidate);
      await sleep(THROTTLE_MS);
      if (uid) {
        usedQuery = candidate;
        break;
      }
    }
    if (!uid) {
      process.stderr.write(
        `  ${reaction.slug}: no MeSH match (tried: ${candidates.join(", ")})\n`,
      );
      continue;
    }

    const detail = await summariseMeshDescriptor(uid);
    await sleep(THROTTLE_MS);
    if (!detail) {
      process.stderr.write(`  ${reaction.slug}: esummary failed for ${uid}\n`);
      continue;
    }

    const headings = (detail.ds_meshterms ?? []).map(normaliseDescriptorName);
    const meshName = headings[0]?.trim() || usedQuery;
    const entryTerms = headings.slice(1).filter((t) => t && t !== meshName);
    const scopeNote = detail.ds_scopenote?.trim();
    const descriptorId = detail.ds_meshui?.trim();
    const treeNumbers = (detail.ds_idxlinks ?? [])
      .map((l) => l.treenum?.trim())
      .filter((t): t is string => Boolean(t));
    const parentUids = (detail.ds_idxlinks ?? [])
      .map((l) => (l.parent != null ? String(l.parent) : null))
      .filter((u): u is string => Boolean(u));

    if (!scopeNote || !descriptorId || treeNumbers.length === 0) {
      process.stderr.write(
        `  ${reaction.slug}: incomplete MeSH record (uid=${uid}, ` +
          `note=${Boolean(scopeNote)}, id=${descriptorId ?? "—"}, ` +
          `trees=${treeNumbers.length})\n`,
      );
      continue;
    }

    withMatch += 1;

    const pmids = await searchPmids(meshName);
    await sleep(THROTTLE_MS);
    let references: LiteratureReference[] = [];
    if (pmids.length > 0) {
      const summaries = await summarisePmids(pmids);
      await sleep(THROTTLE_MS);
      references = summaries
        .map(toReference)
        .filter((r): r is LiteratureReference => r !== null);
      if (references.length > 0) withRefs += 1;
    }

    partial.push({
      slug: reaction.slug,
      meshUid: uid,
      meshDescriptorId: descriptorId,
      meshDescriptorName: meshName,
      meshEntryTerms: entryTerms,
      scopeNote,
      treeNumbers,
      parentUids,
      references,
    });

    process.stderr.write(
      `  ${reaction.slug}: ${descriptorId} (${meshName}), ` +
        `${references.length} refs [${processed}/${reactions.length}]\n`,
    );
  }

  // Resolve parent UIDs in one batched call so each meta record can
  // carry human-readable parent names without 2× per-reaction roundtrips.
  const allParentUids = [
    ...new Set(partial.flatMap((p) => p.parentUids)),
  ].sort();
  process.stderr.write(
    `[fetch-reaction-meta] resolving ${allParentUids.length} parent MeSH UIDs…\n`,
  );
  const parentResolved = await summariseMeshParents(allParentUids);

  const out = new Map<string, ReactionMeta>();
  for (const p of partial) {
    const parents: MeshTreeNode[] = [];
    const seen = new Set<string>();
    for (const parentUid of p.parentUids) {
      if (seen.has(parentUid)) continue;
      seen.add(parentUid);
      const info = parentResolved.get(parentUid);
      if (!info || !info.descriptorId) continue;
      try {
        parents.push({
          uid: parentUid,
          descriptorId: info.descriptorId,
          name: info.name,
        });
      } catch {
        // descriptorId failed schema regex; skip silently
      }
    }

    const meta: ReactionMeta = {
      meshDescriptorId: p.meshDescriptorId,
      meshUid: p.meshUid,
      meshDescriptorName: p.meshDescriptorName,
      meshEntryTerms: p.meshEntryTerms,
      scopeNote: p.scopeNote,
      treeNumbers: p.treeNumbers,
      parents,
      meshBrowserUrl: `https://www.ncbi.nlm.nih.gov/mesh/${p.meshUid}`,
      references: p.references,
      provenance: buildProvenance(
        p.meshDescriptorName,
        p.meshUid,
        p.references.map((r) => r.pmid),
      ),
    };
    try {
      ReactionMetaSchema.parse(meta);
    } catch (err) {
      process.stderr.write(
        `  ! schema failed for ${p.slug}: ${(err as Error).message}\n`,
      );
      continue;
    }
    out.set(p.slug, meta);
  }

  const text = emitSeed(out);
  writeFileSync(OUT_FILE, text, "utf8");
  process.stderr.write(
    `[fetch-reaction-meta] wrote ${OUT_FILE} ` +
      `(${out.size}/${reactions.length} matched, ${withRefs} with references, ` +
      `${withMatch} MeSH hits)\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[fetch-reaction-meta] FAILED: ${msg}\n`);
  process.exit(1);
});
