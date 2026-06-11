# AGENTS.md — guidance for AI agents and contributors

This file gives Claude / Cursor / Windsurf agents (and human
contributors) the project's design rules so changes stay consistent
as the codebase grows.

## Mission

pharmacopeia is a **developer-first reference API** for medications. It
is not a clinical tool, EHR integration, or decision-support system. It
intentionally stays in the "PokeAPI for X" lane — structured public
facts about drugs, classes, interactions, and indications, shipped as
predictable JSON.

## Architectural rules (do not violate without discussion)

1. **Slugs are forever.** Every entity is keyed by a stable
   `lowercase-with-hyphens` slug. Slugs never change. Numeric IDs are
   never exposed in the API.
2. **Versioned URL prefix.** Every public route lives under
   `/api/v1`. Breaking changes ship as `/api/v2`.
3. **Zod is the source of truth.** `lib/schemas/` defines every entity,
   request, and response. Route handlers validate inputs and the
   repository validates seed data; runtime types and TypeScript types
   are both derived from Zod.
4. **Per-record provenance.** Every persisted record carries a
   `provenance` object: `sourceUrl`, `sourceHash`, `extractedAt`,
   `extractor`, `confidence`. This is the audit trail and the unlock
   for selective refresh.
5. **Section-level extraction (later stages).** When the LLM pipeline
   lands, each section of a drug record (mechanism, indications,
   interactions, etc.) is extracted, reviewed, and persisted
   independently. Adding a new section is additive.
6. **Repository indirection.** API routes depend on
   `getRepository()` from `lib/data/repository.ts`. They never import
   `seed/` files directly. Swapping seed → Supabase is a single-file
   change.
7. **Idempotent pipelines.** Any ingest or extract step must be
   re-runnable safely. Use upserts keyed on `(sourceId, sourceHash, section)`.
8. **Jurisdiction-tagged.** Every drug carries `jurisdiction`. v0 is
   `US-FDA` only; multi-jurisdiction is additive, never a fork.
9. **Disclaimer is non-negotiable.** Every drug page and every public
   surface carries the "educational / informational use only" notice.
10. **Cache by default.** `GET` routes set
    `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
    unless they're explicitly hot.

## Adding a new entity type

1. Create a Zod schema in `lib/schemas/<entity>.ts`.
2. Add seed data in `lib/data/seed/<entity>.ts`.
3. Extend `PharmacopeiaRepository` with the new methods.
4. Implement them in `StaticRepository`, validating seed data at construction.
5. Add `app/api/v1/<entity>/...` route handlers using
   `getRepository()` and the shared `ok` / `notFound` helpers.
6. Add a browse page `app/<entity>s/page.tsx` and detail page
   `app/<entity>s/[slug]/page.tsx`. Mirror the drug/class layout.
7. Update `app/docs/page.tsx` endpoint table.

## The real database (Stage 1 — shipped)

Supabase Postgres behind the same repository interface, via **Prisma**:

1. `prisma/schema.prisma` defines document-style tables: each entity
   row stores its full Zod-validated record as a jsonb `payload` plus
   extracted columns for keys, filtering, and search. The Zod schemas
   in `lib/schemas/` remain the single source of truth for shapes.
2. `lib/data/prisma-repository.ts` implements `PharmacopeiaRepository`.
   Point lookups and paginated lists are per-request SQL; derived
   surfaces (brands, ATC tree, MoA graph, reactions index, structure
   fingerprints) build once per process from the shared pure functions
   in `lib/data/dataset-views.ts` and friends.
3. `getRepository()` returns `PrismaRepository` when `DATABASE_URL` is
   set, else the static seed repository. `/api/v1/health` reports which.
4. `scripts/db/seed.ts` (`npm run db:seed`) pushes the validated seed
   dataset into Postgres — an idempotent snapshot load.
5. Env vars: `DATABASE_URL` (transaction pooler, runtime) and
   `DIRECT_URL` (session pooler, CLI/seeding). The Prisma CLI hangs on
   Supabase's transaction pooler — `prisma.config.ts` prefers
   `DIRECT_URL` for that reason.

The seed repository (static TypeScript data baked into the bundle)
stays in the tree as a fallback for local dev without env vars. Both
backends must stay behaviourally identical — new derived views belong
in backend-agnostic modules, never in one repository only.

## Semantic retrieval, grounded tier, webhooks (shipped)

1. **Passages** (`lib/data/passages.ts`) are the retrieval unit: every
   drug record is chunked into citable passages by pure functions
   shared by both repositories and `scripts/db/seed.ts`, so backends
   can never disagree about passage ids or text.
2. **Embeddings** (`lib/ai/embeddings.ts`) pin the model + dimensions
   (text-embedding-3-small, 512). Vectors live in pgvector
   (`passages.embedding`); `npm run db:embed` fills them delta-based —
   re-seeding nulls the vector only when a passage's text hash changed.
3. **`searchPassages()`** on the repository serves
   `/api/v1/semantic-search` and `/api/v1/grounded`. Embedding path on
   Postgres when a provider is configured, lexical TF-IDF fallback
   otherwise — same response shape, `method` reports which.
4. **API keys** (`lib/auth/api-keys.ts`): sha256-at-rest rows minted by
   `npm run keys:create`, or plaintext via `PHARMACOPEIA_API_KEYS` for
   zero-db deployments. Gate `/v1/grounded` and `/v1/webhooks`.
5. **Webhooks** (`lib/webhooks/dispatch.ts`): HMAC-SHA256-signed
   deliveries (`t=<ts>,v1=<hex>` over `<ts>.<body>`), per-attempt
   delivery log, auto-disable after 25 consecutive failures. Events
   fire from `db:seed` by diffing provenance hashes.
6. New endpoints must be registered in `lib/sdk/manifest.ts` (+
   schemas in `lib/sdk/registry.ts`) and regenerated with
   `npm run codegen` so SDKs and OpenAPI never drift.

## Data pipeline rules (Stage 2+)

- LLM extraction prompts live in `lib/llm/prompts/<section>.ts`.
- Every extraction call must return JSON validated by a Zod schema.
- Every extracted field carries provenance referencing the source span.
- A second-pass review step verifies citation spans and assigns a
  confidence score. Records below threshold land in `/review` (not
  the public API) until human review.
- Refreshes are delta-based: a section is re-extracted only if its
  source hash changed.

## Naming and style

- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components.
- Routes: lowercase plural for collections (`/drugs`), singular for
  detail (`/drug/[slug]`). Match the API URL shape exactly.
- Comments only explain non-obvious intent. Don't narrate code.
- No emojis in code unless explicitly requested.

## What this project is not

- Not a clinical decision-support tool.
- Not an EHR or FHIR integration layer.
- Not a symptom checker or diagnostic API.
- Not a wrapper around paid feeds (DrugBank full, SNOMED CT outside
  IHTSDO member countries, UpToDate, Lexicomp, etc.).
- Not a medical device under FDA SaMD or EU MDR. Keep all language
  reference-style, never recommendation-style.
