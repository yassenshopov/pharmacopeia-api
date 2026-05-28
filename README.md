# pharmacopeia-api

> An open, developer-first reference API for medications. JSON in, JSON
> out, validated with Zod, free to use. Inspired by PokeAPI.

This repository is the v0 preview. It ships with a hand-curated mock
dataset for the 10 most-prescribed drugs in the United States so the
entire site is browsable end-to-end without any database or external
service.

> **For educational and informational use only.** Not a clinical
> reference. Not a substitute for professional medical advice.

## Stack

- **Next.js 16** App Router on Vercel
- **TypeScript** strict
- **Tailwind v4** + **shadcn/ui**
- **Zod** schemas as the single source of truth for the API
- **Supabase Postgres** (Stage 1+, not wired in v0)
- **Anthropic Claude** for the data extraction + review pipeline (Stage 2+)

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> for the site and
<http://localhost:3000/api/v1/stats> for the API.

## Project layout

```
app/
  page.tsx                    — landing page
  drugs/                      — browse + per-drug pages
  classes/                    — browse + per-class pages
  docs/                       — generated API reference
  api/v1/
    stats/route.ts
    drugs/route.ts
    drug/[slug]/route.ts
    drug/[slug]/interactions/route.ts
    classes/route.ts
    class/[slug]/route.ts
    ingredients/route.ts
    ingredient/[slug]/route.ts
    search/route.ts
    interactions/check/route.ts
lib/
  schemas/                    — Zod schemas, single source of truth
  data/
    repository.ts             — swappable Drug/Class/Ingredient repo
    mock/                     — hand-curated MVP data
  api/response.ts             — shared JSON response helpers
components/
  site-header.tsx
  site-footer.tsx
  code-block.tsx
  stat-card.tsx
  ui/                         — shadcn/ui primitives
```

## API tour

```bash
curl http://localhost:3000/api/v1/stats
curl http://localhost:3000/api/v1/drug/metformin
curl http://localhost:3000/api/v1/drug/metformin/interactions
curl http://localhost:3000/api/v1/class/ace-inhibitor
curl "http://localhost:3000/api/v1/search?q=blood+thinner"
curl -X POST http://localhost:3000/api/v1/interactions/check \
  -H "content-type: application/json" \
  -d '{"drugs":["lisinopril","ibuprofen"]}'
```

## Roadmap

The build is staged so each step delivers a working, shippable product.

| Stage | Scope | Anthropic credits |
|-------|----------------------------------------------|----------|
| 0 ✅ | 10 drugs, mock data, full API + UI shape | ~$0 |
| 1 | Top 200 drugs via openFDA + Sonnet extraction | ~$200 |
| 2 | Top 1,000 drugs, MCP server, llms.txt | ~$500 |
| 3 | Top 5,000 drugs, Stripe billing, Pro endpoint | ~$1,500 |
| 4 | Community PRs, new entity types | ongoing |

See [`AGENTS.md`](./AGENTS.md) for guidance on extending the data model
or wiring in a real backend.

## Data sources (planned)

- **openFDA** — labels, FAERS, Drugs@FDA, NDC, recalls (public domain)
- **DailyMed** — SPL XML, daily refresh (public domain)
- **RxNorm / RxNav / RxClass** — nomenclature + classifications (public domain)
- **DrugBank Open Subset** — chemistry + targets (CC0)
- **PubChem** — chemical structures (public domain)
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
