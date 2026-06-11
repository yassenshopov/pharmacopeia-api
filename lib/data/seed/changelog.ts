import type { ChangelogEntry } from "@/lib/schemas";

/**
 * Curated record of notable changes shipped to the dataset and the
 * surrounding API surface. This is the source for the public
 * `/feed.xml` and `/feed.json` "what's new" feeds and the
 * `/changelog` page.
 *
 * Append new entries to the top — most recent first. Each entry is
 * immutable once it ships; use a new entry to correct or supersede an
 * old one. The `id` doubles as the RSS `<guid>` and JSON Feed `id`,
 * so consumers de-duplicate cleanly across polls.
 *
 * Style:
 *  - title: imperative, reference-style ("Added structures",
 *           "Released v0 preview"). Never recommendation-style.
 *  - summary: one paragraph explaining what changed and why a
 *             consumer would care.
 *  - sources: canonical public URLs justifying the change.
 */
export const SEED_CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-06-10-semantic-grounded-webhooks",
    kind: "endpoint",
    action: "added",
    title: "Semantic retrieval, grounded tier, and webhooks",
    summary:
      "Three new API surfaces: GET /api/v1/semantic-search retrieves drug-record passages by meaning (pgvector embeddings with a lexical fallback — the response reports which path answered); POST /api/v1/grounded is the first key-gated tier, returning the same passages with per-span citations that carry full provenance for LLM consumers; and /api/v1/webhooks registers HMAC-signed outbound webhooks on dataset changes so caches can invalidate instead of polling this feed.",
    timestamp: "2026-06-10T13:00:00.000Z",
    url: "/docs",
    sources: [],
    tags: ["semantic-search", "grounded", "webhooks", "api-keys"],
  },
  {
    id: "2026-06-10-postgres-backend",
    kind: "dataset",
    action: "released",
    title: "Supabase Postgres backend behind the same repository contract",
    summary:
      "The API now serves from Supabase Postgres through Prisma when DATABASE_URL is configured, with the static seed dataset remaining as the zero-config fallback. Document-style rows keep the Zod schemas as the single source of truth, and /api/v1/health reports which backend answered. No contract changes — both backends are behaviourally identical.",
    timestamp: "2026-06-10T12:00:00.000Z",
    url: "/roadmap",
    sources: [],
    tags: ["postgres", "prisma", "supabase"],
  },
  {
    id: "2026-05-28-compare-and-feed",
    kind: "endpoint",
    action: "added",
    title: "Side-by-side comparison + public change feed",
    summary:
      "New /compare view puts two or three drug records next to each other for quick reference contrast across class, mechanism, indications, identifiers, and 2D structure. A public RSS/JSON feed at /feed.xml and /feed.json now lists notable dataset changes so consumers can watch the contract evolve without scraping.",
    timestamp: "2026-05-28T22:30:00.000Z",
    url: "/compare",
    sources: [],
    tags: ["ui", "feed", "rss"],
  },
  {
    id: "2026-05-28-sdks-published",
    kind: "endpoint",
    action: "released",
    title: "TypeScript and Python SDKs published",
    summary:
      "@pharmacopeia/client (npm) and pharmacopeia (PyPI) ship as thin, fully-typed clients. Types are generated from the same Zod schemas the API uses, so request and response shapes can never silently drift from the server. Tagged releases on GitHub publish both packages automatically.",
    timestamp: "2026-05-28T22:00:00.000Z",
    url: "/docs#sdks",
    sources: [
      "https://www.npmjs.com/package/@pharmacopeia/client",
      "https://pypi.org/project/pharmacopeia/",
    ],
    tags: ["sdk", "typescript", "python"],
  },
  {
    id: "2026-05-28-structural-analogs",
    kind: "structure",
    action: "added",
    title: "Structural analogs (Tanimoto over 2D fingerprints)",
    summary:
      "Each drug record now exposes its structurally nearest neighbours, computed offline with OpenChemLib's 512-bit substructure fingerprint and the Tanimoto coefficient. Educational structural proximity only — never a claim of therapeutic equivalence. Surfaced at GET /api/v1/drug/{slug}/similar and on the drug detail page.",
    timestamp: "2026-05-28T21:00:00.000Z",
    url: "/drugs",
    sources: ["https://openmolecules.org/openchemlib/"],
    tags: ["chemistry", "endpoint"],
  },
  {
    id: "2026-05-28-openfda-narratives",
    kind: "interaction",
    action: "added",
    title: "openFDA drug-interaction narratives",
    summary:
      "Every drug with an openFDA structured-product label now carries its 'drug_interactions' section verbatim. One-sided narrative text only — the pair-graph Interaction schema stays reserved for the day a real structured DDI source lands. Visible on /drugs/[slug] and tagged on /interactions.",
    timestamp: "2026-05-28T20:30:00.000Z",
    url: "/interactions",
    sources: ["https://open.fda.gov/apis/drug/label/"],
    tags: ["openfda", "interactions"],
  },
  {
    id: "2026-05-28-pubchem-structures",
    kind: "structure",
    action: "added",
    title: "PubChem 2D structures + self-hosted SVGs",
    summary:
      "~304 drug records now carry SMILES, InChIKey, IUPAC name, PubChem CID, and a self-hosted SVG rendered offline with OpenChemLib. Biologics and mixtures are intentionally omitted (no clean single-molecule diagram).",
    timestamp: "2026-05-28T19:00:00.000Z",
    url: "/drugs",
    sources: ["https://pubchem.ncbi.nlm.nih.gov/"],
    tags: ["chemistry", "pubchem"],
  },
  {
    id: "2026-05-28-atc-mechanism-graphs",
    kind: "endpoint",
    action: "added",
    title: "WHO ATC tree + mechanism-of-action graph",
    summary:
      "Two new browse surfaces: /atc renders the WHO Anatomical Therapeutic Chemical hierarchy as a nested tree (levels 1–5), and /moa shows the mechanism-of-action network of drugs, MoA classes, and molecular targets. APIs at GET /api/v1/atc and GET /api/v1/mechanisms/graph.",
    timestamp: "2026-05-28T18:00:00.000Z",
    url: "/atc",
    sources: ["https://www.whocc.no/atc_ddd_index/"],
    tags: ["classes", "endpoint"],
  },
  {
    id: "2026-05-28-v0-preview",
    kind: "dataset",
    action: "released",
    title: "v0 preview released",
    summary:
      "First public preview of pharmacopeia. ~310 of the most-prescribed drugs in the United States, ingested from RxNav, openFDA, and PubChem and baked into the source tree as static seed data. Full API + UI browsable end-to-end without any database. Every field links back to its public source via a per-record provenance object.",
    timestamp: "2026-05-28T17:00:00.000Z",
    url: "/",
    sources: [
      "https://rxnav.nlm.nih.gov/",
      "https://open.fda.gov/",
      "https://pubchem.ncbi.nlm.nih.gov/",
    ],
    tags: ["release", "v0"],
  },
];

export const SEED_CHANGELOG_BY_ID: Record<string, ChangelogEntry> =
  Object.fromEntries(SEED_CHANGELOG.map((e) => [e.id, e]));
