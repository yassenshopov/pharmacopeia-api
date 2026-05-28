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
   repository validates mock data; runtime types and TypeScript types
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
   `mock/` files directly. Swapping mock → Supabase is a single-file
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
2. Add mock data in `lib/data/mock/<entity>.ts`.
3. Extend `PharmacopeiaRepository` with the new methods.
4. Implement them in `MockRepository`, validating mocks at construction.
5. Add `app/api/v1/<entity>/...` route handlers using
   `getRepository()` and the shared `ok` / `notFound` helpers.
6. Add a browse page `app/<entity>s/page.tsx` and detail page
   `app/<entity>s/[slug]/page.tsx`. Mirror the drug/class layout.
7. Update `app/docs/page.tsx` endpoint table.

## Adding a real database (Stage 1)

Plan, do not change the API contract:

1. Add Supabase project, set `DATABASE_URL` + `SUPABASE_*` env vars.
2. Add Drizzle schema in `lib/db/schema.ts` mirroring the Zod schemas
   plus provenance columns.
3. Create `lib/data/supabase-repository.ts` implementing
   `PharmacopeiaRepository`.
4. Update `getRepository()` to return `SupabaseRepository` when
   `DATABASE_URL` is set, else fall back to mock.
5. Add a `scripts/ingest/` pipeline that writes through the same
   schemas (download → parse → upsert).

The mock repository stays in the tree as a fallback for local dev
without env vars.

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
