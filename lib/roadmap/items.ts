/**
 * Roadmap is the single source of truth for what we've shipped, what
 * we're building right now, and what's queued. The `/roadmap` page is
 * a thin renderer over `ROADMAP_ITEMS` — adding a future entry should
 * be one append to this array, never a JSX edit.
 *
 * Rules for new entries:
 * - `id` is a stable kebab-case slug. Never rename once shipped.
 * - `shipped` requires `shippedAt` (ISO date).
 * - `in-progress` should set `startedAt`.
 * - `next` / `later` may set `targetAt`.
 * - Keep `title` to one sentence-case line. `body` is 1-3 sentences
 *   that explain *why* the work exists, not what the code does.
 */

export type RoadmapStatus =
  | "shipped"
  | "in-progress"
  | "next"
  | "later"
  | "exploring";

export type RoadmapKind =
  | "platform"
  | "data"
  | "ui"
  | "api"
  | "seo"
  | "a11y"
  | "docs"
  | "devx"
  | "research";

export type RoadmapLink = { label: string; url: string };

export type RoadmapItem = {
  id: string;
  title: string;
  body?: string;
  status: RoadmapStatus;
  kind: RoadmapKind;
  milestone?: string;
  shippedAt?: string;
  startedAt?: string;
  targetAt?: string;
  tags?: string[];
  links?: RoadmapLink[];
};

const SHIPPED_AT = "2026-05-28";
const NEXT_TARGET = "2026-06-30";

export const ROADMAP_ITEMS: RoadmapItem[] = [
  // ── Shipped ────────────────────────────────────────────────────────
  {
    id: "scaffold-next-tailwind-shadcn",
    title:
      "Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn/ui scaffold",
    body: "The base every other line of code stands on. App Router gives us per-route server components, Tailwind v4 collapses the design tokens into CSS, and shadcn keeps the component surface small and ownable.",
    status: "shipped",
    kind: "platform",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "zod-schemas-source-of-truth",
    title: "Zod schemas as single source of truth for every entity",
    body: "Runtime validation and TypeScript types both derive from one schema per entity, so a malformed seed record or response fails fast at the boundary instead of leaking into the UI.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["zod"],
  },
  {
    id: "v1-api-routes",
    title: "v1 API routes for stats, drugs, classes, ingredients, search",
    body: "Public JSON surface under /api/v1 covers reading drugs, classes, ingredients, pairwise interaction checks, and full-text search — the contract the rest of the project is being built against.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "repository-pattern",
    title: "Repository pattern with seed-backed implementation",
    body: "Routes depend on getRepository(), never on seed files directly. Swapping seed for Supabase later is a single-file change instead of a sweep across every handler.",
    status: "shipped",
    kind: "platform",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "apothecary-palette",
    title: "Apothecary palette: warm parchment light + warm ink dark",
    body: "Custom palette tuned for long-form reference reading instead of generic shadcn neutral. The dark mode leans warm so chemical structures and code samples stay legible.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "view-transitions-theme-switch",
    title: "Custom theme switch with View Transitions API clip-path reveal",
    body: "Theme toggle uses the View Transitions API to wipe the new palette from the cursor outward — a small touch that turns a routine control into a memorable one.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "typography-stack",
    title: "Outfit + Inter + Geist Mono typography stack",
    body: "Outfit for display, Inter for body, Geist Mono for code and identifiers. Three families is the most we can spend before page weight gets noticeable.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "sticky-header",
    title: "Sticky header with logo, nav, theme toggle",
    body: "Persistent navigation so deep drug detail pages still feel anchored to the rest of the site.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "multi-column-footer",
    title: "Multi-column footer (Brand / Explore / Sources / Community)",
    body: "Footer doubles as a sitemap. The Sources column is intentional — citing openFDA, RxNav, and DailyMed up front sets expectations about what kind of data lives here.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "landing-page",
    title: "Landing page with hero, live stats counters, code samples",
    body: "First-impression page sells the API in three glances: what it is, how big the dataset is right now, and what a request looks like.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "browse-pages-drugs-classes",
    title: "Browse pages for drugs and classes",
    body: "Flat index pages that let humans discover what the API already exposes, instead of forcing them to read /api/v1/drugs JSON.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "detail-pages-drug-class",
    title: "Detail pages: drug, drug class, with full content sections",
    body: "Per-drug pages render mechanism, indications, dosing, pharmacokinetics, identifiers, and interactions as readable sections — the same shape that ships through the API.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "docs-page",
    title: "Docs page with endpoint reference and quickstart",
    body: "Self-contained reference: quickstart code, conventions, every endpoint with a one-line description, and the trust indicator legend.",
    status: "shipped",
    kind: "docs",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "per-record-provenance",
    title:
      "Per-record provenance (sourceUrl, sourceHash, extractedAt, extractor, confidence) on every entity",
    body: "Every record carries an audit trail so users can see where a fact came from, when it was extracted, and how confident the pipeline was. This is the unlock for selective refresh later.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "real-data-ingest-rxnav-openfda",
    title:
      "Real-data ingest pipeline: RxNav (NIH) + openFDA, 310 drugs / 730 classes / 310 ingredients",
    body: "The seed dataset is real public-source data joined from RxNav and openFDA. Idempotent re-runs keyed on (rxcui, hash) mean upstream refresh is one command. 100% openFDA label coverage; 100% mechanism (label + class-derived); 99% indications; 96% ATC; 93% brands; 93% contraindications.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["rxnav", "openfda", "ingest"],
  },
  {
    id: "depth-label-sections-approvals",
    title:
      "Depth pass: FDA label sections, approval history, NDC/UNII, derived MOA targets",
    body: "Beyond the headline narrative, each record now carries verbatim openFDA label sections — boxed warning, dosage & administration, warnings & precautions, adverse reactions, use in specific populations, and overdosage — plus product NDCs and the UNII identifier from the same label. Approval history (application number, type, original approval date, sponsor) comes from the openFDA drugsfda endpoint. Mechanism targets are derived from the drug's MOA RxClass memberships, and drugs with no labeled mechanism narrative get a classification-style mechanism summary so the section is rarely empty. Coverage across the 310: dosage 99%, adverse reactions 93%, approval history 99%, derived targets 84%, boxed warnings 38%. All additive, all free-source, no schema break.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["openfda", "drugsfda", "ingest", "provenance"],
  },
  {
    id: "structural-similarity-tanimoto",
    title: "Structural analogs via Tanimoto similarity over 2D fingerprints",
    body: "Every drug page surfaces its closest structural analogs, precomputed offline with OpenChemLib's 512-bit substructure index and the Tanimoto coefficient over the PubChem SMILES we already ingested. Large peptides/biologics are excluded (the fingerprint saturates and would link any two peptides), and the threshold is tuned for precision so same-class families — ACE inhibitors, benzodiazepines, beta blockers, PPIs — cluster cleanly. Exposed at /api/v1/drug/{slug}/similar. Structural proximity only, never therapeutic equivalence.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["pubchem", "openchemlib", "chemistry"],
  },
  {
    id: "atc-explorer",
    title: "ATC classification explorer",
    body: "A /atc page that organises the WHO Anatomical Therapeutic Chemical hierarchy by anatomical main group, with each subgroup linking to its class record and member drugs. The 14 level-1 groups are anchored from the canonical WHO set since RxClass only returns the deeper subgroups.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["atc", "rxclass"],
  },
  {
    id: "provenance-badge-ui",
    title:
      "Provenance badge UI with AI-extracted / auto-sourced / curated classification",
    body: "Each fact is tagged with how it got here. A reader can tell at a glance whether a sentence came from an LLM extraction, a deterministic API join, or a human review.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "aurora-hero",
    title: "Animated aurora hero background",
    body: "Subtle motion behind the landing hero. Disabled under prefers-reduced-motion so it never becomes a vestibular trigger.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "stat-card-count-up",
    title: "Stat-card count-up animations on scroll",
    body: "Cards tween from zero to their real value when they enter the viewport, gated by IntersectionObserver and prefers-reduced-motion. The numbers feel earned.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "floating-toc",
    title: "Floating sticky ToC on drug detail and docs pages",
    body: "Right-rail table of contents tracks the active section as you scroll. Long reference pages stop feeling like an infinite scroll.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "molecular-structures-pubchem",
    title:
      "Molecular structure 2D diagrams from PubChem SMILES via OpenChemLib (304 of 310 drugs)",
    body: "Drug pages render the actual 2D structure from a PubChem-sourced SMILES, pre-generated via OpenChemLib and post-processed to follow `currentColor` so bonds stay legible in both palettes. The six skipped entries (biologics like dulaglutide and enoxaparin, and salts/polymers like sucralfate, cyanocobalamin, ferrous-sulfate, insulin-lispro) are cases where no single-component SMILES is meaningful.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["pubchem", "openchemlib"],
  },
  {
    id: "seo-metadata-pass",
    title:
      "SEO pass: full metadata, canonical URLs, robots, manifest, sitemap",
    body: "Every page exports a real Metadata object and canonical URL. Sitemap is generated from the repository so new entities surface to crawlers automatically.",
    status: "shipped",
    kind: "seo",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "jsonld-structured-data",
    title:
      "JSON-LD structured data: WebSite + Organization + Drug + TechArticle + BreadcrumbList",
    body: "Structured data so Google can render rich results for drugs and so the breadcrumb trail in SERPs matches the on-page trail.",
    status: "shipped",
    kind: "seo",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "dynamic-og-images",
    title: "Dynamic OG images via next/og ImageResponse",
    body: "Every page gets a generated 1200×630 social card with the right title and subtitle — no manual PNG juggling.",
    status: "shipped",
    kind: "seo",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "breadcrumbs-everywhere",
    title:
      "Breadcrumbs on every detail/list page with BreadcrumbList JSON-LD",
    body: "Consistent navigation trail above every H1, mirrored in JSON-LD so the path search engines see matches the path the user sees.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "wig-audit",
    title: "WIG (Web Interface Guidelines) audit pass",
    body: "Skip-link, focus-visible rings, motion-reduce on every transition, color-scheme meta, tabular-nums on numeric columns, and translate=\"no\" on drug identifiers so Google Translate doesn't mangle them.",
    status: "shipped",
    kind: "a11y",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "noindex-api-responses",
    title: "X-Robots-Tag noindex on API responses",
    body: "JSON endpoints carry X-Robots-Tag: noindex so search engines don't index raw API responses and dilute the canonical page URLs.",
    status: "shipped",
    kind: "seo",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "env-example",
    title: ".env example with NEXT_PUBLIC_SITE_URL",
    body: "Documented environment surface so a fresh clone knows exactly which variables matter for absolute URLs and OG image generation.",
    status: "shipped",
    kind: "devx",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "idempotent-ingest-scripts",
    title:
      "Idempotent ingest scripts (npm run ingest, npm run ingest:structures)",
    body: "Re-running ingest is safe: upserts keyed on (sourceId, sourceHash) mean we never duplicate records and selective refresh is one flag away.",
    status: "shipped",
    kind: "devx",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },

  {
    id: "command-palette-search",
    title: "Global ⌘K command palette + inline list-page filter + /search page",
    body: "One search surface across the site: a ⌘K palette anywhere, an inline filter on every index page, and a full /search results page for deep queries.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["cmdk", "search"],
  },
  {
    id: "ingredients-pages",
    title: "/ingredients browse + detail pages",
    body: "Ingredient records were already in the API; this exposes them with a browse index, a per-ingredient detail page (identifiers, structure where shared with the drug, and every drug that contains it), and ingredient-side filtering on /api/v1/drugs.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "interactions-ui",
    title: "/interactions interactive check UI",
    body: "Interactive multi-select that posts to /api/v1/interactions/check, renders severity-graded pairs and a per-severity summary, and links to the per-drug openFDA narrative for the (still empty) pair-graph gap.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "pagination-filtering",
    title: "Pagination + client filter on drugs/classes/ingredients lists",
    body: "Every browse page now paginates (24 per page, windowed control with first/last + neighbors) and the client filter scopes to the full dataset. Ready for 5,000-drug scale without changing the UI when server-side pagination lands.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "theme-color-sync",
    title:
      "Sync viewport.themeColor (dark) and manifest.theme_color to the warm-ink palette",
    body: "Mobile browser chrome and installed-PWA chrome now match the apothecary warm-ink. The seam between OS chrome and the page is gone in dark mode.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "apple-touch-icon-set",
    title: "Real apple-touch-icon + maskable PWA icon + Safari mask-icon",
    body: "Generated 180×180 apple-touch and 32×32 favicon via Next file-based ImageResponse, plus static SVG + maskable SVG + monochrome Safari pinned-tab — replacing the create-next-app placeholder set.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },

  // ── Next ──────────────────────────────────────────────────────────
  {
    id: "supabase-stage-1",
    title:
      "Stage 1: Supabase Postgres backend with Drizzle, switching getRepository() based on env",
    body: "Real database behind the same repository interface. Seed stays as the local fallback; production reads through SupabaseRepository when DATABASE_URL is set.",
    status: "next",
    kind: "platform",
    milestone: "stage-1",
    targetAt: NEXT_TARGET,
  },
  {
    id: "scheduled-ingest-cron",
    title:
      "Ingest pipeline runs on schedule (Vercel cron) and writes deltas to Supabase",
    body: "Idempotent ingest jobs invoked by Vercel cron so dataset freshness is hands-off. Section hashes mean unchanged content costs nothing.",
    status: "next",
    kind: "data",
    milestone: "stage-1",
    targetAt: NEXT_TARGET,
  },
  {
    id: "icd10-snomed-crosswalks",
    title:
      "ICD-10 + SNOMED CT (where licensable) crosswalks on indications",
    body: "Map every indication to a standard clinical code so downstream consumers can join pharmacopeia data against EHR or research datasets.",
    status: "next",
    kind: "data",
    targetAt: NEXT_TARGET,
  },
  {
    id: "ema-jurisdiction",
    title:
      "EMA (European Medicines Agency) jurisdiction added alongside US-FDA",
    body: "Multi-jurisdiction is additive: same drug, additional jurisdiction-tagged records. EMA is the obvious first non-US source.",
    status: "next",
    kind: "data",
    targetAt: NEXT_TARGET,
    tags: ["jurisdiction"],
  },

  // ── Later ─────────────────────────────────────────────────────────
  {
    id: "llm-section-extraction",
    title:
      "Stage 2: LLM-driven section extraction per drug (Claude) with anti-hallucination review pass",
    body: "Per-section LLM extraction with a deterministic second-pass verifier. Below-threshold confidence lands in /review, never in the public API.",
    status: "later",
    kind: "data",
    milestone: "stage-2",
    tags: ["claude", "llm"],
  },
  {
    id: "section-level-provenance",
    title:
      "Section-level provenance (every mechanism/indication/contraindication paragraph carries its own provenance + confidence)",
    body: "Drop provenance granularity from per-record to per-section so refreshing one paragraph doesn't cascade across an entire drug.",
    status: "later",
    kind: "data",
    milestone: "stage-2",
  },
  {
    id: "embeddings-semantic-search",
    title: "Embeddings + semantic search across drug content",
    body: "Augment lexical search with embeddings so queries like \"beta blocker safe in asthma\" find what they mean, not what they spell.",
    status: "later",
    kind: "api",
    tags: ["embeddings"],
  },
  {
    id: "llm-citation-tier",
    title: "LLM citation/grounding API tier (paid)",
    body: "First paid tier: a /v1/grounded endpoint that returns LLM-friendly retrieval over pharmacopeia content with per-token citations.",
    status: "later",
    kind: "api",
    tags: ["llm", "billing"],
  },
  {
    id: "mcp-server",
    title: "MCP server for Claude/Cursor/Codex integration",
    body: "Native Model Context Protocol server so coding agents can pull drug, class, and interaction facts straight into their context window.",
    status: "later",
    kind: "api",
    tags: ["mcp"],
  },
  {
    id: "webhooks-on-changes",
    title: "Webhooks on entity changes",
    body: "Outbound webhooks fire when a drug record (or any of its sections) changes, so downstream caches can invalidate instead of polling.",
    status: "later",
    kind: "api",
  },
  {
    id: "whats-new-feed",
    title: "Real-time \"what's new\" feed / RSS",
    body: "A public RSS/JSON feed of recent record changes so consumers and curators can watch the dataset evolve without scraping.",
    status: "later",
    kind: "docs",
  },
  {
    id: "multi-language-summaries",
    title: "Multi-language drug summaries",
    body: "Translated summaries for the most-read fields, with the same provenance and confidence model used for English content.",
    status: "later",
    kind: "data",
  },
  {
    id: "sdk-clients",
    title: "SDK clients (TypeScript, Python)",
    body: "Thin generated clients in TS and Python so consumers don't hand-roll fetch wrappers. Types come from the same Zod schemas the API uses.",
    status: "later",
    kind: "devx",
  },
  {
    id: "marketplace-listings",
    title: "Marketplace listings (RapidAPI, Vercel Marketplace)",
    body: "Distribution channels for the paid tier — turnkey signup, billing, and quotas without rebuilding the platform pieces ourselves.",
    status: "later",
    kind: "platform",
    tags: ["distribution"],
  },
  {
    id: "scale-five-thousand-drugs",
    title: "Scale to 5,000+ drugs",
    body: "Push the dataset past the long tail of common medications into a near-exhaustive US-FDA reference. Mostly an ingest and review-throughput problem.",
    status: "later",
    kind: "data",
  },
  {
    id: "brand-generic-crosswalk",
    title: "Brand → generic crosswalk index page",
    body: "A dedicated /brands index that lets users land on a brand name (Glucophage) and pivot straight to the generic (metformin) with the full record. Built from RxNorm brand concepts already in the dataset.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },

  // ── Exploring ─────────────────────────────────────────────────────
  {
    id: "clinicaltrials-crosswalk",
    title: "Drug → trial crosswalk via ClinicalTrials.gov API",
    body: "Open question: surface active trials per drug. The API is generous but the data model is messy — needs design before commit.",
    status: "exploring",
    kind: "research",
    tags: ["clinicaltrials"],
  },
  {
    id: "atc-moa-visualizations",
    title: "Interactive visualizations: MoA graph, deeper ATC tree",
    body: "A flat /atc explorer and structural-analog lists already ship. The open work is the interactive layer: a D3 mechanism-of-action graph and a fully expandable ATC tree (levels 1–5 with the intermediate WHO names). Educational, not clinical.",
    status: "exploring",
    kind: "ui",
    tags: ["d3", "visualization"],
  },
  {
    id: "patient-facing-summary-mode",
    title: "Patient-facing summary mode (plain-language toggle)",
    body: "Toggle on every drug page that swaps clinical prose for a plain-language summary at roughly an 8th-grade reading level. Provenance and disclaimer stay.",
    status: "exploring",
    kind: "ui",
    tags: ["readability"],
  },
  {
    id: "pharmacogenomics-cyp450",
    title: "Pharmacogenomic markers and CYP450 interactions",
    body: "PGx markers and CYP450 metabolism data per drug. Real value for research consumers, but licensing and data quality vary wildly by source.",
    status: "exploring",
    kind: "data",
    tags: ["pgx"],
  },
  {
    id: "pubmed-pmid-crosswalks",
    title: "PMID literature crosswalks via PubMed",
    body: "Link drug records to canonical literature via PubMed PMIDs so users can jump from a fact to the paper that produced it.",
    status: "exploring",
    kind: "data",
    tags: ["pubmed"],
  },
];

export function roadmapStats(): {
  shipped: number;
  inProgress: number;
  next: number;
  later: number;
  exploring: number;
} {
  const counts = {
    shipped: 0,
    inProgress: 0,
    next: 0,
    later: 0,
    exploring: 0,
  };
  for (const item of ROADMAP_ITEMS) {
    switch (item.status) {
      case "shipped":
        counts.shipped++;
        break;
      case "in-progress":
        counts.inProgress++;
        break;
      case "next":
        counts.next++;
        break;
      case "later":
        counts.later++;
        break;
      case "exploring":
        counts.exploring++;
        break;
    }
  }
  return counts;
}
