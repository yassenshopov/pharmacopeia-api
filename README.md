# pharmacopeia-api

> An open, developer-first reference API for medications. JSON in, JSON
> out, validated with Zod, free to use.

This repository is the v0 preview. It ships with **~310 of the most-
prescribed drugs in the United States**, ingested from RxNav, openFDA,
and PubChem and baked into the source tree as static seed data, so the
entire site and API are browsable end-to-end without any database or
external service.

Each drug record carries mechanism + derived targets, indications and
contraindications, FDA label sections (boxed warning, dosing, adverse
reactions, warnings, special populations, overdosage), approval history,
identifiers (RxCUI, NDC, UNII), a self-hosted 2D structure, and
structural analogs computed from its fingerprint. Every field links back
to its public source via a `provenance` object.

> **For educational and informational use only.** Not a clinical
> reference. Not a substitute for professional medical advice.

## Stack

- **Next.js 16** App Router on Vercel
- **TypeScript** strict
- **Tailwind v4** + **shadcn/ui**
- **Zod** schemas as the single source of truth for the API
- **OpenChemLib** for 2D structure rendering + similarity fingerprints
- **Supabase Postgres** + **Prisma** — serves the whole API when
  `DATABASE_URL` is set; without it the site falls back to the static
  seed dataset
- **Anthropic Claude** for the data extraction + review pipeline (Stage 2+)

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> for the site and
<http://localhost:3000/api/v1/stats> for the API.

```bash
npm test              # Vitest: unit + repository contract + route tests
npm run typecheck     # tsc --noEmit
```

Tests run against the static seed dataset by default; set
`TEST_DATABASE_URL` to also run the repository contract suite against
Postgres. CI (GitHub Actions) runs both on every push and PR.

## What's in the dataset

| Entity        | Count | Notes                                            |
|---------------|-------|--------------------------------------------------|
| Drugs         | ~310  | Full records with FDA label depth + provenance   |
| Classes       | ~730  | RxClass: ATC, FDA EPC, mechanism of action, MeSH |
| Ingredients   | ~310  | Active ingredients linked to their drugs         |
| 2D structures | ~304  | Self-hosted SVGs rendered from PubChem SMILES     |
| Analogs       | ~125  | Drugs with ≥1 structural analog (Tanimoto ≥ 0.75) |

## Project layout

```
app/
  page.tsx                    — landing page
  drugs/                      — browse + per-drug pages (depth + analogs)
  classes/                    — browse + per-class pages
  ingredients/                — browse + per-ingredient pages
  brands/                     — brand → generic crosswalk
  atc/                        — WHO ATC classification explorer
  interactions/               — interaction checker
  docs/                       — generated API reference
  roadmap/                    — public roadmap
  api/v1/
    stats/route.ts
    drugs/route.ts            — ?class=<slug> / ?ingredient=<slug> filters
    drug/[slug]/route.ts
    drug/[slug]/interactions/route.ts
    drug/[slug]/similar/route.ts
    classes/route.ts
    class/[slug]/route.ts
    ingredients/route.ts
    ingredient/[slug]/route.ts
    brands/route.ts
    search/route.ts
    interactions/check/route.ts
lib/
  schemas/                    — Zod schemas, single source of truth
  data/
    repository.ts             — swappable Drug/Class/Ingredient repo
    seed/                     — ingested static data (RxNav/openFDA/PubChem)
  api/response.ts             — shared JSON response helpers
  roadmap/items.ts            — roadmap source of truth
components/
  site-header.tsx
  site-footer.tsx
  pagination-controls.tsx
  *-list-client.tsx           — searchable, paginated browse lists
  ui/                         — shadcn/ui primitives
scripts/
  ingest/
    shared.ts                 — shared fetchers + record builder (both pipelines)
    curated-names.ts          — hand-curated core drug list
    fetch-drugs.ts            — curated TS seed (RxNav + openFDA)
    build-universe.ts         — RxNorm → programmatic 5,000+ candidate universe
    fetch-drugs-scale.ts      — concurrent, resumable scale ingest → NDJSON
    fetch-structures.ts       — PubChem → 2D structure SVGs
    fetch-interactions.ts     — openFDA interaction narratives
    fetch-similarity.ts       — OpenChemLib Tanimoto structural analogs
```

## API tour

```bash
curl http://localhost:3000/api/v1/stats
curl http://localhost:3000/api/v1/drug/metformin
curl http://localhost:3000/api/v1/drug/lisinopril/similar
curl http://localhost:3000/api/v1/drug/metformin/interactions
curl http://localhost:3000/api/v1/class/ace-inhibitors-plain
curl "http://localhost:3000/api/v1/drugs?ingredient=metformin"
curl http://localhost:3000/api/v1/brands
curl "http://localhost:3000/api/v1/search?q=blood+thinner"
curl -X POST http://localhost:3000/api/v1/interactions/check \
  -H "content-type: application/json" \
  -d '{"drugs":["lisinopril","ibuprofen"]}'
```

## Data pipelines

All ingest scripts are idempotent and write static seed files into
`lib/data/seed/`. They are polite to upstream APIs (single-flight, rate
limited) and re-runnable safely.

```bash
npm run ingest               # RxNav + openFDA → drugs, classes, ingredients
npm run ingest:structures    # PubChem → public/structures/*.svg + seed
npm run ingest:interactions  # openFDA → interaction narratives
npm run ingest:similarity     # OpenChemLib → structural analogs (no network)
```

### Scaling to 5,000+ drugs

The curated `npm run ingest` above produces the ~310-drug TS seed baked
into the bundle. The near-exhaustive US-FDA dataset is a separate,
database-only pipeline that shares the exact same record builder
(`scripts/ingest/shared.ts`) so records can't drift:

```bash
npm run ingest:universe      # RxNorm full ingredient space → data/ingest/universe.json
OPENFDA_API_KEY=... npm run ingest:scale   # concurrent, resumable; writes NDJSON artifacts
npm run db:seed              # auto-loads the scale NDJSON when present (else the TS seed)
npm run db:embed             # embed the new passages
```

`ingest:scale` checkpoints every candidate to
`data/ingest/checkpoint.ndjson`, so a killed run resumes where it left
off. Candidates without a real openFDA label are routed to
`data/ingest/review.ndjson` (a coverage report lands in `report.json`)
instead of the public dataset. A free `OPENFDA_API_KEY` is effectively
required — without it openFDA caps at 1,000 requests/day.

With a Supabase project configured (see `.env.example`), push the
schema and load the validated dataset into Postgres:

```bash
npm run db:push              # prisma db push — create/sync tables (incl. pgvector)
npm run db:seed              # snapshot-load the seed dataset into Postgres
npm run db:embed             # embed retrieval passages (delta-based; --all to redo)
npm run keys:create -- --name "my key"   # mint a pk_live_... API key (shown once)
```

Semantic retrieval (`/api/v1/semantic-search`, key-gated
`/api/v1/grounded`) runs on passage embeddings in pgvector when an
embeddings provider is configured, and degrades to a lexical fallback
over the same passages otherwise — identical response shape either
way. Webhooks (`/api/v1/webhooks`) fire on dataset changes detected
during `db:seed`, signed HMAC-SHA256 per delivery.

Structural similarity is precomputed offline with OpenChemLib's 512-bit
substructure index and the Tanimoto coefficient over the SMILES already
in the dataset. Large peptides/biologics are excluded (the fingerprint
saturates) and a 0.75 threshold keeps same-class families clean. This is
structural proximity only — never a claim of therapeutic equivalence.

## Roadmap

The build is staged so each step delivers a working, shippable product.
The live roadmap lives at [`/roadmap`](http://localhost:3000/roadmap)
(source: [`lib/roadmap/items.ts`](./lib/roadmap/items.ts)).

| Stage | Scope | Anthropic credits |
|-------|----------------------------------------------|----------|
| 0 ✅ | ~310 drugs, static seed, full API + UI, structures + analogs | ~$0 |
| 1 | openFDA + Sonnet extraction at depth, Supabase persistence | ~$200 |
| 2 | Top 1,000 drugs, MCP server, llms.txt | ~$500 |
| 3 | Top 5,000 drugs, Stripe billing, Pro endpoint | ~$1,500 |
| 4 | Community PRs, new entity types | ongoing |

See [`AGENTS.md`](./AGENTS.md) for guidance on extending the data model
or wiring in a real backend.

## Data sources

Shipped in v0:

- **RxNorm / RxNav / RxClass** — nomenclature + classifications (public domain)
- **openFDA** — labels, Drugs@FDA approval history, NDC (public domain)
- **PubChem** — chemical structures + SMILES (public domain)

Planned:

- **DailyMed** — SPL XML, daily refresh (public domain)
- **DrugBank Open Subset** — chemistry + targets (CC0)
- **ChEMBL** — drug-target bioactivity (CC-BY-SA 3.0)
- **Orange Book** — generics + patents (public domain)
- **ICD-10-CM** — condition codes (public domain in US)

No paid feeds. No SNOMED CT in v0 (license complexity outside member
countries). No DrugBank full DB (commercial license).

## Disclaimer

pharmacopeia is not affiliated with the FDA, NIH, NLM, or any
regulatory agency. Every record links to its canonical public source
via the `provenance.sourceUrl` field; verify against that source before
acting on any value. The maintainers make no warranty as to accuracy,
completeness, or fitness for any particular purpose.
