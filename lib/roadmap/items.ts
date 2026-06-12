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
    id: "test-suite-ci",
    title: "Vitest test suite + GitHub Actions CI",
    body: "Unit tests for the pure modules (passages, dataset views, sparse fieldsets, rate limits, webhook signing), a repository contract suite that pins StaticRepository and PrismaRepository to identical behaviour, and route-handler tests for envelopes, ETags, and error shapes. CI runs typecheck + tests on every push and PR so regressions surface before deploy, not after.",
    status: "shipped",
    kind: "devx",
    shippedAt: "2026-06-11",
    tags: ["vitest", "ci"],
  },
  {
    id: "full-endpoint-test-coverage",
    title: "Every public endpoint covered by a route-handler test",
    body: "Extends the initial six-endpoint suite to the whole v1 surface — catalog, derived views (ATC tree, MoA graph, brands), structure and semantic search, per-drug subresources, reactions, and the changelog — each asserted for status, cache headers, and a schema-valid body. GraphQL gets execution + REST-parity tests so the two read surfaces can't diverge. The suite now runs 170 tests across 16 files.",
    status: "shipped",
    kind: "devx",
    shippedAt: "2026-06-12",
    tags: ["vitest", "coverage"],
  },
  {
    id: "api-surface-drift-guards",
    title: "Automated guards against SDK/OpenAPI/route drift",
    body: "Tests that fail the build when the SDK manifest, the generated OpenAPI 3.1 document, and the actual route files disagree: every manifest operation resolves to a real handler that exports its method, every request/response schema exists in the registry, every $ref resolves, and the committed openapi.json is regenerable byte-for-byte. Drift between the spec, the SDKs, and the live API is now a red CI check instead of a silent lie.",
    status: "shipped",
    kind: "devx",
    shippedAt: "2026-06-12",
    tags: ["openapi", "sdk", "codegen"],
  },
  {
    id: "a11y-web-guidelines",
    title: "Accessibility + Web Interface Guidelines audit of the public site",
    body: "Audited the layout, header, navigation, theme toggle, browse shell, search, code blocks, and the interactive MoA graph against the Web Interface Guidelines. The surface already holds up: a skip link and `main` landmark, labelled controls, `:focus-visible` rings everywhere, decorative icons `aria-hidden`, accessible names on every icon-only button, `prefers-reduced-motion` honoured, explicit (never `transition: all`) transitions, and a `role=\"img\"` accessible name plus per-node labels on the SVG graph. No defects found; the audit stands as the baseline to hold the line against.",
    status: "shipped",
    kind: "a11y",
    shippedAt: "2026-06-12",
  },
  {
    id: "scale-ready-read-path",
    title: "Read path scales to the 5,000+ drug dataset",
    body: "Browse pages, pickers, and the sitemap stopped assuming the dataset fits in one response: filtering and pagination moved server-side (?q= on every list endpoint, URL-driven browse pages), pickers query the API with debounced lookups instead of preloading hundreds of records, and the sitemap walks the full dataset in pages. One canonical search-haystack module keeps static and Postgres filtering identical.",
    status: "shipped",
    kind: "platform",
    shippedAt: "2026-06-11",
    tags: ["scale", "pagination"],
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

  {
    id: "response-envelope-schemas",
    title: "Typed response envelope schemas for every endpoint",
    body: "Each endpoint's payload shape now lives in lib/schemas/responses.ts as Zod, and handlers are annotated with `satisfies` against it. The response contract is as type-safe as the entities, and it's the single definition both the API and the SDK generator read from.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["zod", "contract"],
  },
  {
    id: "openapi-spec",
    title: "OpenAPI 3.1 document generated from the schema registry",
    body: "Every v1 endpoint is described in a generated sdk/openapi.json, emitted from the same Zod response schemas the handlers validate against. It's the source the SDK clients are built from and the seed for an interactive API reference.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["openapi", "codegen"],
  },
  {
    id: "sdk-clients",
    title: "Generated TypeScript + Python SDK clients from Zod schemas",
    body: "A schema-driven codegen pipeline (npm run codegen) turns the route manifest and Zod response registry into typed TypeScript and Python clients plus an OpenAPI document — no hand-rolled fetch wrappers, and the clients describe responses with the exact Zod definitions the API serves. Regenerating is one command, so the SDKs can never drift from the contract.",
    status: "shipped",
    kind: "devx",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["sdk", "codegen", "openapi"],
  },
  {
    id: "atc-moa-visualizations",
    title: "Interactive MoA graph + fully expandable ATC tree (levels 1–5)",
    body: "The /atc page is now a fully expandable WHO ATC tree from anatomical main group down to substance, with the intermediate level-2/3 WHO group names filled in. A new /moa page renders a D3 force-directed mechanism-of-action network — drugs, MoA classes, and molecular targets as nodes — backed by GET /api/v1/atc and GET /api/v1/mechanisms/graph. Educational structural views, never clinical.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["d3", "atc", "visualization"],
  },
  {
    id: "faq-glossary-pages",
    title: "FAQ and glossary pages with FAQPage + DefinedTermSet structured data",
    body: "A /faq page answers the recurring \"is this clinical / where's the data from / can I use it\" questions, and a /glossary defines the domain terms (ATC, MoA, Tanimoto, provenance, RxCUI). Both emit schema.org JSON-LD (FAQPage and DefinedTermSet) so the answers and definitions are eligible for rich results.",
    status: "shipped",
    kind: "docs",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["seo", "content"],
  },

  // ── Next ──────────────────────────────────────────────────────────
  {
    id: "supabase-stage-1",
    title:
      "Stage 1: Supabase Postgres backend with Prisma, switching getRepository() based on env",
    body: "Real database behind the same repository interface. Document-style tables keep the Zod schemas as the single source of truth (each row is a validated jsonb payload plus extracted filter/search columns), PrismaRepository serves every endpoint when DATABASE_URL is set, and the static seed stays as the zero-config local fallback. /api/v1/health reports which backend answered.",
    status: "shipped",
    kind: "platform",
    milestone: "stage-1",
    shippedAt: "2026-06-10",
    tags: ["prisma", "supabase", "postgres"],
  },
  {
    id: "scheduled-ingest-cron",
    title:
      "Ingest pipeline runs on schedule (Vercel cron) and writes deltas to Supabase",
    body: "Daily Vercel cron hits /api/cron/refresh-shortages (CRON_SECRET-gated) to re-pull openFDA drug shortages straight into Postgres — the fastest-moving dataset is now hands-off. The crosswalk logic is shared with the seed pipeline via lib/ingest/shortages.ts, and a content hash over the rebuilt dataset skips the table rewrite when upstream hasn't changed. Heavier surfaces (labels, FAERS) join the schedule as they get the same delta treatment.",
    status: "shipped",
    kind: "data",
    milestone: "stage-1",
    shippedAt: "2026-06-11",
    tags: ["cron", "openfda"],
  },
  {
    id: "icd10-snomed-crosswalks",
    title:
      "ICD-10 + SNOMED CT (where licensable) crosswalks on indications",
    body: "ICD-10-CM codes (public domain) now ride on indications via a curated keyword crosswalk in lib/ingest/icd10.ts — conservative by design: precision over recall, fill-only, never overwrites richer codes from a later extraction stage. Applied identically at ingest, at db:seed, and in the static fallback. SNOMED CT stays pending licensing review (IHTSDO member-country scope).",
    status: "shipped",
    kind: "data",
    shippedAt: "2026-06-11",
    tags: ["icd10", "crosswalk"],
  },
  {
    id: "ema-jurisdiction",
    title:
      "EMA (European Medicines Agency) jurisdiction added alongside US-FDA",
    body: "Multi-jurisdiction is additive: same drug, additional jurisdiction-tagged records. EMA is the obvious first non-US source. Groundwork shipped: /v1/drugs?jurisdiction= filters by regulatory agency on both backends (validated against the jurisdiction enum), so EMA records land without an API change. The EMA ingest source itself is still queued.",
    status: "in-progress",
    kind: "data",
    startedAt: "2026-06-11",
    targetAt: NEXT_TARGET,
    tags: ["jurisdiction"],
  },

  {
    id: "interactive-api-reference",
    title: "Interactive API reference rendered from the OpenAPI document",
    body: "Live OpenAPI 3.1 document served at /api/v1/openapi.json and rendered as a browsable, try-it reference (Scalar) at /reference. Built from the same Zod schemas the handlers validate against, so the spec, the SDK clients, and the live API can't drift.",
    status: "shipped",
    kind: "docs",
    shippedAt: SHIPPED_AT,
    tags: ["openapi", "easy-win"],
  },
  {
    id: "llms-txt",
    title: "llms.txt for AI-agent discoverability",
    body: "Publishes /llms.txt and a longer /llms-full.txt following the llmstxt.org convention. Both are generated live from the API manifest and the repository, so they always reflect the current endpoint surface and dataset counts.",
    status: "shipped",
    kind: "seo",
    shippedAt: SHIPPED_AT,
    tags: ["llms", "easy-win"],
  },
  {
    id: "conditional-requests-etag",
    title: "ETag + conditional GET (304 Not Modified) on read routes",
    body: "Every GET response is hashed into a strong ETag and short-circuits to 304 Not Modified when the client sends a matching If-None-Match. Layered with the existing Cache-Control policy so CDNs and clients revalidate cheaply.",
    status: "shipped",
    kind: "api",
    shippedAt: SHIPPED_AT,
    tags: ["caching", "easy-win"],
  },
  {
    id: "health-endpoint",
    title: "Health/version endpoint (GET /api/v1/health)",
    body: "A tiny liveness + dataset-version envelope so monitors and consumers can confirm the API is up and which snapshot they're hitting, without parsing a real payload. Schema lives next to the others and ships in the generated SDKs.",
    status: "shipped",
    kind: "api",
    shippedAt: SHIPPED_AT,
    tags: ["easy-win"],
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
    body: "A /v1/semantic-search endpoint over passage-level retrieval: every drug record is chunked into citable passages (lib/data/passages.ts), embedded offline into pgvector (npm run db:embed, text-embedding-3-small at 512 dims), and queried by cosine similarity with the query embedded at request time. Without an embeddings provider or database the same passages are scored by a lexical TF-IDF fallback — identical response shape, and the `method` field reports which path answered. Re-embedding is delta-based: re-seeding nulls the vector only for passages whose text hash changed.",
    status: "shipped",
    kind: "api",
    shippedAt: "2026-06-10",
    tags: ["embeddings", "pgvector"],
  },
  {
    id: "llm-citation-tier",
    title: "LLM citation/grounding API tier (paid)",
    body: "First key-gated tier: POST /v1/grounded returns the same passage retrieval as /v1/semantic-search, repackaged for LLM consumers — every passage carries a citation id and a full-coverage character-span → citation mapping, and every citation carries the record's provenance (source URL, content hash, extraction timestamp, confidence) plus a permalink. Keys are minted by npm run keys:create (sha256-at-rest, shown once) or supplied via PHARMACOPEIA_API_KEYS for zero-db deployments; db-backed keys track lifetime request counts surfaced in the response usage block.",
    status: "shipped",
    kind: "api",
    shippedAt: "2026-06-10",
    tags: ["llm", "billing", "api-keys"],
  },
  {
    id: "mcp-server",
    title: "MCP server (pharmacopeia-mcp) for Claude / Cursor / Codex",
    body: "A standalone npm package (pharmacopeia-mcp) that wraps the generated TypeScript client as a Model Context Protocol server. Hosts spawn it over stdio with `npx -y pharmacopeia-mcp`; every tool is a thin proxy over the live API contract (search, get_drug, get_drugs_batch, check_interactions, structure_search, get_drug_shortages, get_drug_adverse_events, get_drug_literature, etc.), so the tool surface can't drift from the API. Released in lockstep with the TS / Python SDKs via the same GitHub Actions workflow.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["mcp", "claude", "cursor", "agents"],
  },
  {
    id: "webhooks-on-changes",
    title: "Webhooks on entity changes",
    body: "Outbound webhooks (drug.created / drug.updated / drug.deleted / dataset.refreshed) fire when the dataset load detects record changes by provenance hash, so downstream caches can invalidate instead of polling /changelog. Consumers register HTTPS endpoints via the key-gated /v1/webhooks API; deliveries are HMAC-SHA256 signed (Stripe-style t=<ts>,v1=<hex> over <ts>.<body>), logged per attempt, and an endpoint auto-disables after 25 consecutive failures.",
    status: "shipped",
    kind: "api",
    shippedAt: "2026-06-10",
    tags: ["webhooks", "hmac"],
  },
  {
    id: "whats-new-feed",
    title: "\"What's new\" changelog page + RSS 2.0 + JSON Feed",
    body: "A public /changelog page plus /feed.xml (RSS 2.0) and /feed.json (JSON Feed 1.1), all reading from the same listChangelog repository method so the three surfaces can't drift. Entries are typed (drug / class / ingredient / interaction / structure / dataset / endpoint × added / updated / removed / released) and the HTML page advertises both feeds via <link rel=\"alternate\"> so subscribers don't have to guess the URL.",
    status: "shipped",
    kind: "docs",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["rss", "json-feed"],
  },
  {
    id: "derived-views-precompute",
    title: "Derived views precomputed at seed time",
    body: "Brands, the ATC tree, and the mechanism graph are pure functions over the whole dataset — at 5,000+ drugs, building them per process means loading every payload on cold start. Seeding now materialises them into a derived_views table and the Prisma repository serves the precomputed row, falling back to building from the snapshot only when a row is missing. Same pure builders either way, so the two paths can't disagree.",
    status: "in-progress",
    kind: "platform",
    startedAt: "2026-06-11",
    tags: ["scale", "postgres"],
  },
  {
    id: "cron-refresh-adverse-events",
    title: "Rotating FAERS refresh on the cron schedule",
    body: "openFDA caps requests, so 5,000 drugs can't refresh in one run. The cron route refreshes the stalest N drugs per invocation (tracked by each aggregate's extractedAt), so the whole dataset cycles continuously without any single run being heavy. Same shared-module rule as shortages: per-record logic lives in lib/ingest/, used by both the script and the route.",
    status: "in-progress",
    kind: "data",
    startedAt: "2026-06-11",
    tags: ["cron", "openfda", "faers"],
  },
  {
    id: "fuzzy-search-fallback",
    title: "Typo-tolerant search (trigram fallback)",
    body: "When exact substring search comes up empty, a shared trigram-similarity scorer re-ranks candidate names so 'metfornin' still finds metformin. One pure scoring module used by both backends — identical results whether the data lives in the bundle or Postgres.",
    status: "in-progress",
    kind: "api",
    startedAt: "2026-06-11",
    tags: ["search"],
  },
  {
    id: "route-test-coverage-full",
    title: "Route tests across the whole public surface",
    body: "Extend the route suite beyond the core read path: semantic-search and grounded (auth + envelope), webhooks (key gating), shortages, adverse events, reactions, brands, ATC, mechanism graph, changelog, stats, and the OpenAPI document. Every contract the SDKs generate against gets a test that fails when a handler drifts.",
    status: "in-progress",
    kind: "devx",
    startedAt: "2026-06-11",
    tags: ["vitest"],
  },
  {
    id: "multi-language-summaries",
    title: "Multi-language drug summaries",
    body: "Translated summaries for the most-read fields, with the same provenance and confidence model used for English content.",
    status: "later",
    kind: "data",
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
    body: "Push the dataset past the long tail of common medications into a near-exhaustive US-FDA reference. The scale pipeline is in place: a programmatic candidate universe built from RxNorm's full ingredient space (npm run ingest:universe, ~14k candidates tiered curated → prescribable → extended), a concurrent checkpoint-resumable ingest (npm run ingest:scale) sharing the exact record builder with the curated seed, an openFDA-label publish gate that sends unlabeled candidates to review.ndjson instead of the public dataset, and NDJSON artifacts that db:seed loads straight into Supabase while the bundle keeps the small curated fallback.",
    status: "in-progress",
    kind: "data",
    startedAt: "2026-06-11",
    tags: ["rxnorm", "openfda", "ingest", "supabase"],
  },
  {
    id: "rate-limiting-api-keys",
    title: "Per-key rate limiting + quotas",
    body: "Every key-gated endpoint now enforces two layers per key: a requests-per-minute window (in-memory fixed window, best-effort per instance) and a precise daily quota counted in Postgres on the key row, rolling over at UTC midnight. Limits are per-key columns (npm run keys:create -- --rate-limit N --daily-quota N), reported via X-RateLimit-* and X-Quota-* headers on every response, and exceeded requests get a 429 with Retry-After and error code rate_limited. Env-var keys keep the minute window (PHARMACOPEIA_RATE_LIMIT_PER_MINUTE) but carry no quota — zero-db deployments have nowhere durable to count.",
    status: "shipped",
    kind: "platform",
    shippedAt: "2026-06-11",
    tags: ["billing", "api-keys"],
  },
  {
    id: "batch-lookup-endpoint",
    title: "Batch lookup endpoint (POST /api/v1/drugs/batch)",
    body: "Resolve up to 100 drug slugs in one round trip. Body is { slugs: string[] }; the response carries the full Drug records that resolved and a separate `missing` array for the slugs that did not, so callers never have to diff request and response themselves. Duplicates collapse server-side. Picked up by the OpenAPI doc and both SDK clients automatically through codegen.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["easy-win"],
  },
  {
    id: "sparse-fieldsets",
    title: "Field selection (sparse fieldsets via ?fields=)",
    body: "GET /api/v1/drug/{slug}?fields=mechanism,interactions,labelSections drops the un-requested sections from the response — identity fields (slug, name, classes, identifiers, provenance) always come back. Heavy verbatim FDA label sections, the full indications list, and approval history are the main payload-savers. Additive and backwards-compatible: omit the param and the response is the full record exactly as before. Documented on the SDK manifest so both TS and Python clients accept the parameter.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["easy-win"],
  },
  {
    id: "interaction-pair-graph",
    title: "Interaction network graph across the dataset",
    body: "Fill the still-empty pair-graph gap: a drug↔drug interaction network with severity-weighted edges, exposed as data and as a D3 view that reuses the mechanism-graph rendering. Educational aggregate view, not a clinical checker. Gated on sourcing a real structured DDI dataset — RxNav `interaction` is retired, openFDA's `drug_interactions` field is one-sided narrative (already surfaced via `interactionsNarrative` on the drug record), and the licensed full feeds (DrugBank Plus, Lexicomp) sit outside the project's free-and-public rule. The schema, repository surface, and check endpoint are all ready; waiting on the data.",
    status: "later",
    kind: "data",
    tags: ["d3", "interactions", "blocked-on-data"],
  },
  {
    id: "drug-compare-view",
    title: "Side-by-side drug comparison view at /compare",
    body: "A /compare surface that puts two or three drugs next to each other across the canonical reference axes — identity, classes, mechanism, indications, identifiers, 2D structure, and pairwise interactions between the selected set. The selection lives in ?drugs=a,b,c so a comparison is a shareable URL. Reference contrast only — no \"better than\" / \"preferred over\" language.",
    status: "shipped",
    kind: "ui",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
  },
  {
    id: "publish-sdks-registries",
    title: "Publish SDKs to npm and PyPI on release (GitHub Actions)",
    body: "A .github/workflows/release-sdks.yml workflow regenerates both clients from the live Zod schemas, stamps the SDK manifests with the release version, builds, and publishes — @pharmacopeia/client to npm with provenance, pharmacopeia to PyPI via OIDC trusted publishing. Triggered by an sdk-v<semver> GitHub Release or a manual workflow_dispatch (with a dry-run flag) so a single tag pushes the same version to both registries.",
    status: "shipped",
    kind: "devx",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["sdk", "ci", "npm", "pypi"],
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
    body: "Every drug now carries its registered studies from the ClinicalTrials.gov v2 API: the most recently updated registrations naming the drug as an intervention (query.intr, so an abstract mention is not enough) plus the registry's total match count. New /api/v1/drug/{slug}/trials endpoint, a Clinical trials section on each drug page, and a get_drug_trials MCP tool — all carrying the framing inline: registration is NOT evidence of efficacy or safety. Ingest (npm run ingest:trials) is idempotent and matched all 310 curated drugs.",
    status: "shipped",
    kind: "data",
    shippedAt: "2026-06-11",
    tags: ["clinicaltrials"],
  },
  {
    id: "patient-facing-summary-mode",
    title: "Patient-facing summary mode (plain-language toggle)",
    body: "Toggle on every drug page that swaps clinical prose for a plain-language view at roughly an 8th-grade Flesch-Kincaid reading level. The simplification is a deterministic glossary transform over the same provenanced label text — never a paraphrase — with every swapped phrase highlighted and the original clinical term on hover. Provenance and disclaimer stay.",
    status: "shipped",
    kind: "ui",
    shippedAt: "2026-06-11",
    tags: ["readability", "plain-language"],
  },
  {
    id: "pharmacogenomics-cyp450",
    title: "Pharmacogenomic markers and CYP450 interactions",
    body: "CPIC-curated drug–gene pairs joined onto the dataset by RxCUI from the public CPIC API (the licensing-clean source in this space): per pair the gene symbol, CPIC level (A–D), ClinPGx/PharmGKB clinical annotation level (1A–4), the FDA-label PGx testing annotation where one exists, and a link to the published guideline. New /api/v1/drug/{slug}/pharmacogenomics endpoint, a Pharmacogenomics section on each drug page (123 of 310 curated drugs have pairs), and a get_drug_pharmacogenomics MCP tool. Framed as evidence metadata throughout — never testing or dosing guidance.",
    status: "shipped",
    kind: "data",
    shippedAt: "2026-06-11",
    tags: ["pgx", "cpic"],
  },
  {
    id: "pubmed-pmid-crosswalks",
    title: "PMID literature crosswalks via PubMed",
    body: "Per-drug PubMed reference lists pinned to MeSH major topic for precision. New /api/v1/drug/{slug}/literature endpoint and a Literature section on each drug page. Ingest pipeline (`npm run ingest:literature`) hits the NCBI E-utilities (esearch + esummary), respects the 3 req/s no-key throttle, and uses NCBI_API_KEY for the 10 req/s tier. Records carry title, journal, year, first three authors, optional DOI, and a pre-built pubmed.ncbi.nlm.nih.gov URL.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["pubmed", "ncbi-eutils"],
  },
  {
    id: "graphql-surface",
    title: "GraphQL surface alongside REST",
    body: "A thin GraphQL layer (powered by graphql-yoga) over the same repository the REST API uses. One round-trip can fetch a drug, its mechanism, its interactions, and its structural analogs — exactly the fields the caller selects. GraphiQL IDE at /api/graphql.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["graphql", "graphql-yoga"],
  },
  {
    id: "structure-similarity-search",
    title: "Structure search: paste a SMILES, get the nearest drugs",
    body: "Interactive query over the same OpenChemLib 512-bit fingerprint index that powers per-drug analogs. Paste a SMILES and get the closest drugs in the dataset by 2D Tanimoto similarity. Available at /structure-search and POST /api/v1/structure-search. Structural proximity only, never therapeutic equivalence.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["chemistry", "openchemlib"],
  },
  {
    id: "faers-adverse-signals",
    title: "Aggregate adverse-event counts from openFDA FAERS",
    body: "Per-drug top-N reactions from openFDA `/drug/event` aggregated by `patient.reaction.reactionmeddrapt.exact`. New /api/v1/drug/{slug}/adverse-events endpoint and a FAERS section on each drug page, both shipped with an inline `disclaimer` field and a heavy framing block on the UI: these are voluntarily-submitted REPORTS, not incidence rates, not signals, not causality. Counts reflect reporting volume only. Each row now also surfaces the share (count ÷ total matched reports) so the reader sees both raw volume and relative weight in one glance. Ingest pipeline (`npm run ingest:adverse-events`) refreshes per drug; throttled to keep the openFDA endpoint happy.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["openfda", "faers"],
  },
  {
    id: "reactions-directory",
    title: "Reactions directory (MedDRA Preferred Terms → drugs)",
    body: "A first-class /reactions browse + /reactions/{slug} detail surface (and matching /api/v1/reactions and /api/v1/reaction/{slug} endpoints) that transposes the FAERS top-N reactions across every drug in the dataset. Each reaction page ranks the drugs reporting it by share of their matched reports, ships a 'related reactions' panel ranked by Jaccard similarity over drug-id sets (purely derived graph density — no paid-licence MedDRA SOC mapping required), and 301-redirects American-English alias slugs (Diarrhea → Diarrhoea, Anemia → Anaemia) to their canonical counterparts. Drug-page FAERS rows now link out to the reaction pages, closing the drug ↔ reaction ↔ drug loop. Deliberately framed as a reverse index of reporting volume, NOT a symptom checker and NOT diagnostic guidance — every page and the schema-level `disclaimer` field carry that framing forward to SDK and MCP consumers.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["faers", "meddra", "seo", "graph"],
  },
  {
    id: "reaction-mesh-meta",
    title: "MeSH definitions and PubMed literature per reaction",
    body: "Every reaction page now ships a `meta` block sourced from NLM MeSH and PubMed — never authored in-house. The block carries the matching MeSH descriptor id (e.g. D003967), the librarian-written scope note as a quoted definition, the tree position with linkable parent descriptors, and a small set of recent PubMed papers indexed under the descriptor as a MeSH major topic. Surfaced as a top-of-page Definition block, a tree-position aside, and a Literature section; null for MedDRA administrative terms (\"Drug Ineffective\", \"Off Label Use\") that have no MeSH counterpart. A new `npm run ingest:reaction-meta` script drives a throttled E-utilities crawl with batched parent UID resolution. The schema-level guardrail stays the same: pharmacopeia quotes NLM content verbatim, never paraphrases, and the Literature section is explicit that the citations are about the reaction term itself — not about any specific drug.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["mesh", "pubmed", "faers", "definitions"],
  },
  {
    id: "drug-shortage-crosswalk",
    title: "FDA drug-shortage status crosswalk",
    body: "openFDA `/drug/drugshortages` joined onto each drug record by generic name. New endpoints (/api/v1/drug/{slug}/shortages and /api/v1/shortages), an amber `FDA shortage` badge near the drug page header when at least one entry is active, and a dedicated Shortages section listing every reported presentation with status, sponsor, reason, and FDA-updated date. Independent refresh cadence (`npm run ingest:shortages`) since the upstream list moves on business-day timescales. Reference statistics only.",
    status: "shipped",
    kind: "data",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["openfda", "shortages"],
  },

  // ── Shipped (additional easy-wins) ───────────────────────────────
  {
    id: "health-endpoint-meta",
    title: "/api/v1/health reports repository backend + deployment commit",
    body: "The liveness envelope now includes which repository implementation is serving (`static` for the seed fallback, `supabase` for the real backend) plus the short git SHA from VERCEL_GIT_COMMIT_SHA and the serving region from VERCEL_REGION when available. Monitors can finally distinguish 'up on the seed' from 'up on the real backend', and clients can correlate responses with a specific deployment.",
    status: "shipped",
    kind: "api",
    milestone: "v0",
    shippedAt: SHIPPED_AT,
    tags: ["easy-win", "ops"],
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
