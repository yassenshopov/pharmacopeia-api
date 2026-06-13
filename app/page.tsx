import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Atom,
  BookOpen,
  Boxes,
  FlaskConical,
  GitBranch,
  GitCompare,
  Layers,
  ListTree,
  Network,
  Package,
  Pill,
  Quote,
  Rss,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Workflow,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { HeroAurora } from "@/components/hero-aurora";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";
import { datasetJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, ogImageUrl } from "@/lib/seo/site";

const HOME_TITLE = `${SITE_NAME} · an open API for medications`;
const HOME_OG_IMAGE = ogImageUrl({
  title: "An open API for medications",
  subtitle: "pharmacopeia.dev",
});

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: HOME_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — an open API for medications`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    images: [HOME_OG_IMAGE],
  },
};

const SAMPLE_RESPONSE = `{
  "slug": "metformin",
  "name": "Metformin",
  "jurisdiction": "US-FDA",
  "classes": [
    { "slug": "biguanide", "name": "Biguanide", "kind": "epc" }
  ],
  "mechanism": {
    "summary": "Decreases hepatic glucose production via inhibition of mitochondrial glycerophosphate dehydrogenase \u2026",
    "targets": ["AMP-activated protein kinase (AMPK)"]
  },
  "indications": [
    { "text": "Type 2 diabetes mellitus", "icd10": ["E11"] }
  ],
  "identifiers": {
    "rxcui": "6809",
    "atc": ["A10BA02"],
    "drugbank": "DB00331"
  }
}`;

const SAMPLE_TS_SDK = `// npm i @pharmacopeia/client
import { Pharmacopeia } from "@pharmacopeia/client";

const pc = new Pharmacopeia();
const metformin = await pc.getDrug("metformin");
const pairs = await pc.checkInteractions([
  "warfarin",
  "ibuprofen",
]);`;

const SAMPLE_GROUNDED = `// POST /api/v1/grounded — retrieval built for LLMs
const res = await fetch("/api/v1/grounded", {
  method: "POST",
  headers: { Authorization: "Bearer pk_live_\u2026" },
  body: JSON.stringify({ query: "metformin renal dosing" }),
});

const { passages, citations } = await res.json();
// every passage.grounding span maps to a citation with
// sourceUrl, sourceHash, extractedAt, confidence`;

// Drugs featured in the Explore section — chosen so every slug has a
// pre-rendered SVG under /public/structures and so the row spans well-
// known examples across classes (NSAID, statin, biguanide, SSRI, etc.).
const FEATURED_DRUGS: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: "metformin", name: "Metformin" },
  { slug: "atorvastatin", name: "Atorvastatin" },
  { slug: "aspirin", name: "Aspirin" },
  { slug: "sertraline", name: "Sertraline" },
  { slug: "omeprazole", name: "Omeprazole" },
  { slug: "lisinopril", name: "Lisinopril" },
  { slug: "ibuprofen", name: "Ibuprofen" },
  { slug: "warfarin", name: "Warfarin" },
];

/**
 * Read a pre-generated structure SVG from /public/structures and return
 * its inner markup. Inlining is required so `currentColor` (used for
 * bond strokes) resolves against the page's CSS cascade — when loaded
 * via <img src> the SVG renders in isolation and currentColor falls
 * back to black, making bonds invisible in dark mode.
 *
 * The source SVGs all carry `id="mol5"` from OpenChemLib's renderer.
 * We rewrite that to a slug-scoped id so co-located thumbnails don't
 * collide on shared style selectors.
 */
const loadStructureSvg = cache(async (slug: string): Promise<string | null> => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "structures",
      `${slug}.svg`,
    );
    const raw = await readFile(filePath, "utf8");
    return raw.replace(/mol5/g, `mol-${slug}`);
  } catch {
    return null;
  }
});

export default async function Home() {
  const repo = getRepository();
  const [stats, [latestChange], featuredSvgs] = await Promise.all([
    repo.getStats(),
    repo.listChangelog({ limit: 1 }),
    Promise.all(
      FEATURED_DRUGS.map(async (d) => ({
        ...d,
        svg: await loadStructureSvg(d.slug),
      })),
    ),
  ]);

  return (
    <div>
      <script
        {...jsonLdScriptProps(
          datasetJsonLd({
            drugs: stats.drugs,
            classes: stats.classes,
            ingredients: stats.ingredients,
            version: stats.version,
            updatedAt: stats.updatedAt,
          }),
        )}
      />
      {/* ─────────────────────────────── Hero */}
      {/* `isolate` confines the inner `z-10` wrapper and the aurora's
          mix-blend-mode to this section's stacking context so portaled
          overlays (nav dropdowns, command menu, tooltips) reliably paint
          on top. */}
      <section className="relative isolate overflow-hidden border-b border-border/60">
        <HeroAurora />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          {latestChange && (
            <Link
              href="/changelog"
              className="group mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-background/60 py-1 pl-1 pr-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                New
              </span>
              <span className="truncate">{latestChange.title}</span>
              <ArrowRight
                className="h-3 w-3 flex-none opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          )}

          <Badge
            variant="outline"
            className="mb-8 border-primary/30 bg-primary/10 font-mono text-xs font-normal text-primary"
          >
            v0 · early preview
          </Badge>

          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div
                aria-hidden="true"
                className="mb-6 grid h-14 w-14 place-items-center rounded-lg border border-primary/30 bg-primary/10 font-mono text-2xl text-primary"
              >
                ℞
              </div>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                An open API for medications
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Drugs, classes, interactions, indications, and 2D structures —
                structured, versioned, free. A developer-first reference layer
                for the world&rsquo;s pharmacopeia, available over REST,
                GraphQL, and first-party SDKs.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  Read the docs
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/drugs"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  Browse drugs
                </Link>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-2 lg:max-w-md">
              <StatCard
                label="Drugs"
                value={stats.drugs}
                sublabel="RxNav · openFDA · PubChem"
              />
              <StatCard
                label="Classes"
                value={stats.classes}
                sublabel="ATC · EPC · MoA"
              />
              <StatCard
                label="Ingredients"
                value={stats.ingredients}
                sublabel="Active substances"
              />
              <StatCard
                label="Indications"
                value={stats.indications}
                sublabel="ICD-10 mapped"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Sample */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              One fetch away from every prescription.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Predictable URLs. JSON in, JSON out. Every response is validated
              with{" "}
              <a
                href="https://zod.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Zod
              </a>{" "}
              against the same schema that generates these docs, the SDKs, and
              the OpenAPI document — so the shape never surprises you.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CodeBlock
              code={SAMPLE_RESPONSE}
              label="GET /api/v1/drug/metformin"
              language="json"
            />
            <CodeBlock
              code={SAMPLE_TS_SDK}
              label="@pharmacopeia/client"
              language="ts"
            />
          </div>

          <ul className="mt-10 grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
              Strongly-typed schema for drugs, classes, interactions, and indications.
            </li>
            <li className="flex items-start gap-2">
              <GitBranch className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
              Open data — every entity has a verifiable source URL and hash.
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
              Generated docs, SDKs, and OpenAPI 3.1 from the same Zod schema.
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="mr-1 uppercase tracking-wider">Also available as</span>
            <SurfacePill href="/api/graphql" icon={<Workflow className="h-3.5 w-3.5" />}>
              GraphQL
            </SurfacePill>
            <SurfacePill
              href="https://www.npmjs.com/package/@pharmacopeia/client"
              icon={<Package className="h-3.5 w-3.5" />}
              external
            >
              @pharmacopeia/client
            </SurfacePill>
            <SurfacePill
              href="https://pypi.org/project/pharmacopeia/"
              icon={<Package className="h-3.5 w-3.5" />}
              external
            >
              pharmacopeia (PyPI)
            </SurfacePill>
            <SurfacePill
              href="/api/v1/openapi.json"
              icon={<Boxes className="h-3.5 w-3.5" />}
            >
              OpenAPI 3.1
            </SurfacePill>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Explore */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeader
            eyebrow="01 · Browse"
            title="Explore the dataset"
            body="Every entity is keyed by a stable slug and links back to the canonical public source it came from."
          />

          <div className="mt-10 grid grid-cols-12 gap-4">
            {/* Drugs — large card with real 2D structures */}
            <BentoCard
              href="/drugs"
              className="col-span-12 lg:col-span-8"
              icon={<Pill className="h-5 w-5" />}
              title="Drugs"
              count={stats.drugs}
              body="Mechanism, indications, dosing, identifiers, and 2D structures rendered offline from PubChem."
            >
              <div className="grid grid-cols-4 gap-2 rounded-md border border-border/60 bg-background/60 p-3 sm:grid-cols-4">
                {featuredSvgs.map((d) => (
                  <div
                    key={d.slug}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      aria-hidden="true"
                      className="aspect-[4/3] w-full overflow-hidden text-foreground/70 [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={
                        d.svg
                          ? { __html: d.svg }
                          : { __html: "" }
                      }
                    />
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {d.slug}
                    </span>
                  </div>
                ))}
              </div>
            </BentoCard>

            {/* Classes — kind-tagged chip list */}
            <BentoCard
              href="/classes"
              className="col-span-12 lg:col-span-4"
              icon={<Layers className="h-5 w-5" />}
              title="Classes"
              count={stats.classes}
              body="Pharmacological classes from FDA EPC, WHO ATC, MoA, and MeSH."
            >
              <ul className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3 text-sm">
                <ClassRow kind="epc" name="Statin" code="HMG-CoA Reductase Inhibitor" />
                <ClassRow kind="atc" name="Biguanides" code="A10BA" />
                <ClassRow kind="moa" name="ACE inhibitor" code="EC 3.4.15.1" />
                <ClassRow kind="mesh" name="Antidepressive Agents" code="D000928" />
              </ul>
            </BentoCard>

            {/* ATC tree — monospace indented fragment */}
            <BentoCard
              href="/atc"
              className="col-span-12 sm:col-span-6 lg:col-span-4"
              icon={<ListTree className="h-5 w-5" />}
              title="ATC tree"
              body="Walk the WHO Anatomical Therapeutic Chemical hierarchy, levels 1–5."
            >
              <pre className="overflow-x-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                <span className="text-foreground">A</span>{"  · Alimentary tract and metabolism\n"}
                {"└─ "}<span className="text-foreground">A10</span>{"  · Drugs used in diabetes\n"}
                {"   └─ "}<span className="text-foreground">A10B</span>{" · Blood glucose lowering\n"}
                {"      └─ "}<span className="text-foreground">A10BA</span>{" · Biguanides\n"}
                {"         └─ "}<span className="text-primary">metformin</span>
              </pre>
            </BentoCard>

            {/* MoA graph — hand-drawn mini network */}
            <BentoCard
              href="/moa"
              className="col-span-12 sm:col-span-6 lg:col-span-4"
              icon={<Network className="h-5 w-5" />}
              title="MoA graph"
              body="Tripartite network of drugs, mechanism-of-action classes, and molecular targets."
            >
              <div className="rounded-md border border-border/60 bg-background/60 p-3">
                <MoaPreview />
              </div>
            </BentoCard>

            {/* Brands — brand → generic crosswalk */}
            <BentoCard
              href="/brands"
              className="col-span-12 lg:col-span-4"
              icon={<Tags className="h-5 w-5" />}
              title="Brands"
              body="Brand-to-generic crosswalk. Land on Glucophage, pivot to metformin."
            >
              <ul className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs">
                <BrandRow brand="Glucophage" generic="metformin" />
                <BrandRow brand="Lipitor" generic="atorvastatin" />
                <BrandRow brand="Tylenol" generic="acetaminophen" />
                <BrandRow brand="Zoloft" generic="sertraline" />
              </ul>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Tools */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeader
            eyebrow="02 · Reach for"
            title="Tools built on the API"
            body="Small reference utilities that demonstrate what the public API can do."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* Interactions — severity-graded pair list */}
            <ToolCard
              href="/interactions"
              icon={<GitBranch className="h-5 w-5" />}
              title="Interactions"
              body="Pick a set of drugs and check them pairwise, severity-graded."
            >
              <ToolFrame caption="3 selected · 3 pairs">
                <ul className="divide-y divide-border/40 text-xs">
                  <InteractionRow
                    pair="warfarin × ibuprofen"
                    severity="major"
                  />
                  <InteractionRow
                    pair="sertraline × tramadol"
                    severity="contraindicated"
                  />
                  <InteractionRow
                    pair="metformin × iodine contrast"
                    severity="moderate"
                  />
                </ul>
              </ToolFrame>
            </ToolCard>

            {/* Compare — side-by-side mini diff */}
            <ToolCard
              href="/compare"
              icon={<GitCompare className="h-5 w-5" />}
              title="Compare"
              body="Two or three drugs side by side across class, mechanism, and identifiers."
            >
              <ToolFrame caption="metformin · sertraline">
                <div className="grid grid-cols-2 divide-x divide-border/40 text-xs">
                  <CompareColumn
                    name="Metformin"
                    klass="Biguanide"
                    moa="AMPK activation"
                    atc="A10BA02"
                  />
                  <CompareColumn
                    name="Sertraline"
                    klass="SSRI"
                    moa="5-HT reuptake inhibition"
                    atc="N06AB06"
                  />
                </div>
              </ToolFrame>
            </ToolCard>

            {/* Structure search — SMILES input + match list */}
            <ToolCard
              href="/structure-search"
              icon={<Atom className="h-5 w-5" />}
              title="Structure search"
              body="Paste a SMILES, find the nearest indexed drugs by 2D Tanimoto."
            >
              <ToolFrame caption="SMILES · Tanimoto · OpenChemLib">
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-[11px]">
                    <Atom className="h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
                    <span className="truncate">CC(=O)OC1=CC=CC=C1C(=O)O</span>
                  </div>
                  <ul className="space-y-1 font-mono text-[11px]">
                    <MatchRow slug="salicylic-acid" score="0.89" />
                    <MatchRow slug="diflunisal" score="0.74" />
                    <MatchRow slug="mesalamine" score="0.62" />
                  </ul>
                </div>
              </ToolFrame>
            </ToolCard>

            {/* Search — command palette mockup */}
            <ToolCard
              href="/search"
              icon={<Search className="h-5 w-5" />}
              title="Search"
              body="Find drugs, ingredients, classes, and brands by name or synonym."
            >
              <ToolFrame caption="⌘K · cross-entity">
                <div className="border-b border-border/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-mono">metformin</span>
                    <span className="ml-auto rounded border border-border/60 px-1 font-mono text-[10px]">
                      esc
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-border/40 text-xs">
                  <SearchRow label="Metformin" kind="drug" />
                  <SearchRow label="Glucophage" kind="brand" />
                  <SearchRow label="Biguanide" kind="class" />
                  <SearchRow label="A10BA · Biguanides" kind="atc" />
                </ul>
              </ToolFrame>
            </ToolCard>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Ground */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeader
            eyebrow="03 · Ground"
            title="Retrieval your LLM can cite"
            body="Every record is chunked into small, citable passages. Search them by meaning over plain REST — then reach for the grounded tier when a model needs a verifiable source behind every token."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {/* Semantic search — natural-language query → ranked passages */}
            <ToolCard
              href="/docs#semantic-search"
              icon={<ScanSearch className="h-5 w-5" />}
              title="Semantic search"
              body="Ask what you mean, not what you can spell. Embedding-backed when available, lexical fallback otherwise — same shape either way."
            >
              <ToolFrame caption="GET · semantic-search">
                <div className="border-b border-border/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Search className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    <span className="truncate font-mono">
                      beta blocker safe in asthma
                    </span>
                    <span className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1 font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      embedding
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-border/40">
                  <PassageRow drug="nebivolol" section="mechanism" score={0.82} />
                  <PassageRow drug="metoprolol" section="warnings" score={0.77} />
                  <PassageRow drug="propranolol" section="cautions" score={0.71} />
                </ul>
              </ToolFrame>
            </ToolCard>

            {/* Grounded — passage with inline citation + provenance footer */}
            <ToolCard
              href="/docs#grounded"
              icon={<Quote className="h-5 w-5" />}
              title="Grounded answers"
              body="The key-gated tier for LLM consumers: every passage carries a citation and a character-span grounding map back to its source."
            >
              <ToolFrame caption="POST · grounded · key-gated">
                <div className="space-y-2 p-3">
                  <p className="text-xs leading-relaxed text-foreground/80">
                    Assess renal function before initiating and at least
                    annually; metformin is contraindicated below an eGFR of
                    30&nbsp;mL/min/1.73m².
                    <sup className="ml-0.5 rounded bg-primary/15 px-1 font-mono text-[9px] text-primary">
                      c1
                    </sup>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-2 font-mono text-[10px] text-muted-foreground">
                    <span className="rounded bg-primary/15 px-1 text-primary">
                      c1
                    </span>
                    <span className="text-foreground/70">drug/metformin</span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      0.98
                    </span>
                    <span className="truncate">accessdata.fda.gov</span>
                  </div>
                </div>
              </ToolFrame>
            </ToolCard>
          </div>

          <div className="mt-6">
            <CodeBlock
              code={SAMPLE_GROUNDED}
              label="POST /api/v1/grounded"
              language="ts"
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Build */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeader
            eyebrow="04 · Build"
            title="Build with it"
            body="REST, GraphQL, and typed clients for TypeScript and Python — all generated from the same Zod schema, so the contract never drifts."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* Quickstart — curl + response */}
            <BuildCard
              href="/docs"
              icon={<BookOpen className="h-5 w-5" />}
              title="Quickstart"
              body="Make your first request in under a minute. No key required."
            >
              <CodePreview label="bash">
                <span className="text-primary">curl</span>{" "}
                <span>https://pharmacopeia.dev/api/v1/drug/metformin</span>
              </CodePreview>
            </BuildCard>

            {/* API reference — endpoint list with verb badges */}
            <BuildCard
              href="/reference"
              icon={<Boxes className="h-5 w-5" />}
              title="API reference"
              body="Interactive Scalar reference over the OpenAPI 3.1 document."
            >
              <CodePreview label="endpoints" scrollable={false}>
                <EndpointRow verb="GET" path="/api/v1/drugs" />
                <EndpointRow verb="GET" path="/api/v1/drug/{slug}" />
                <EndpointRow verb="GET" path="/api/v1/drug/{slug}/similar" />
                <EndpointRow verb="POST" path="/api/v1/interactions/check" />
                <EndpointRow verb="POST" path="/api/v1/structure-search" />
                <EndpointRow verb="GET" path="/api/v1/atc" />
              </CodePreview>
            </BuildCard>

            {/* GraphQL — query snippet */}
            <BuildCard
              href="/api/graphql"
              icon={<Workflow className="h-5 w-5" />}
              title="GraphQL"
              body="Field-selected GraphQL surface with a built-in GraphiQL IDE."
            >
              <CodePreview label="graphql">
                <span>{"{"}</span>
                {"\n  "}<span className="text-primary">drug</span>
                <span>(slug: </span>
                <span className="text-amber-700 dark:text-amber-400">&quot;metformin&quot;</span>
                <span>) {"{"}</span>
                {"\n    name\n    classes { name kind }\n    mechanism { summary targets }\n  "}
                <span>{"}"}</span>
                {"\n"}
                <span>{"}"}</span>
              </CodePreview>
            </BuildCard>

            {/* SDKs — install commands for both clients */}
            <BuildCard
              href="/docs#sdks"
              icon={<Package className="h-5 w-5" />}
              title="SDKs"
              body="@pharmacopeia/client on npm · pharmacopeia on PyPI. Typed end-to-end."
            >
              <CodePreview label="install">
                <span className="text-muted-foreground"># TypeScript</span>
                {"\n"}
                <span className="text-primary">npm</span>{" "}
                <span>i @pharmacopeia/client</span>
                {"\n\n"}
                <span className="text-muted-foreground"># Python</span>
                {"\n"}
                <span className="text-primary">pip</span>{" "}
                <span>install pharmacopeia</span>
              </CodePreview>
            </BuildCard>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/changelog"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <Rss className="h-3.5 w-3.5" aria-hidden="true" />
              Changelog
            </Link>
            <Link
              href="/feed.xml"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              RSS
            </Link>
            <Link
              href="/feed.json"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              JSON Feed
            </Link>
            <Link
              href="/llms.txt"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              llms.txt
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              Roadmap
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Closing */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight">
            A community project, made by and for the people who build with
            medical data.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            pharmacopeia is unaffiliated with the FDA, NIH, or any regulatory
            agency. We host structured facts (mechanism, identifiers, dosing)
            and link out to the canonical source for every field. Educational
            and informational use only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/yassenshopov"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              How to contribute
            </a>
            <Link
              href="/roadmap"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              See the roadmap
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              Get started
            </Link>
            <a
              href="https://buymeacoffee.com/yassenshopov"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              Buy me a coffee
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────── Shared section header

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-3 font-mono text-xs uppercase tracking-wider text-primary">
        {eyebrow}
      </div>
      <h2 className="text-balance text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

// ─────────────────────────────── Explore card primitives

function BentoCard({
  href,
  className,
  icon,
  title,
  count,
  body,
  children,
}: {
  href: string;
  className?: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${className ?? ""}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary"
          >
            {icon}
          </span>
          {title}
          {typeof count === "number" && (
            <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {count.toLocaleString()}
            </span>
          )}
        </div>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </header>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </Link>
  );
}

const CLASS_KIND_STYLE: Record<string, { dot: string; label: string }> = {
  epc: { dot: "bg-amber-500", label: "EPC" },
  atc: { dot: "bg-sky-500", label: "ATC" },
  moa: { dot: "bg-violet-500", label: "MoA" },
  mesh: { dot: "bg-emerald-500", label: "MeSH" },
};

function ClassRow({
  kind,
  name,
  code,
}: {
  kind: keyof typeof CLASS_KIND_STYLE;
  name: string;
  code: string;
}) {
  const style = CLASS_KIND_STYLE[kind];
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 flex-none rounded-full ${style.dot}`}
      />
      <span className="flex-1 truncate">
        <span className="text-foreground">{name}</span>
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {code}
        </span>
      </span>
      <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {style.label}
      </span>
    </li>
  );
}

function BrandRow({ brand, generic }: { brand: string; generic: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="truncate text-foreground">{brand}</span>
      <ArrowRight
        aria-hidden="true"
        className="h-3 w-3 flex-none text-muted-foreground"
      />
      <span className="truncate text-primary">{generic}</span>
    </li>
  );
}

function MoaPreview() {
  // Hand-drawn tripartite cluster: targets (left) ─ drugs (mid) ─ MoA
  // classes (right). Stroke uses currentColor so it inherits the theme.
  return (
    <svg
      viewBox="0 0 220 130"
      className="h-32 w-full text-muted-foreground/40"
      role="img"
      aria-label="A schematic network of targets, drugs, and mechanism-of-action classes."
    >
      <g stroke="currentColor" strokeWidth="1" fill="none">
        <line x1="36" y1="30" x2="100" y2="35" />
        <line x1="36" y1="65" x2="100" y2="35" />
        <line x1="36" y1="65" x2="100" y2="70" />
        <line x1="36" y1="100" x2="100" y2="70" />
        <line x1="36" y1="100" x2="100" y2="105" />
        <line x1="100" y1="35" x2="184" y2="40" />
        <line x1="100" y1="70" x2="184" y2="40" />
        <line x1="100" y1="70" x2="184" y2="90" />
        <line x1="100" y1="105" x2="184" y2="90" />
      </g>

      <g>
        <circle cx="36" cy="30" r="5" className="fill-violet-500/40 stroke-violet-500" strokeWidth="1.25" />
        <circle cx="36" cy="65" r="5" className="fill-violet-500/40 stroke-violet-500" strokeWidth="1.25" />
        <circle cx="36" cy="100" r="5" className="fill-violet-500/40 stroke-violet-500" strokeWidth="1.25" />
      </g>
      <g>
        <circle cx="100" cy="35" r="7" className="fill-amber-500/40 stroke-amber-500" strokeWidth="1.25" />
        <circle cx="100" cy="70" r="9" className="fill-amber-500/40 stroke-amber-500" strokeWidth="1.25" />
        <circle cx="100" cy="105" r="7" className="fill-amber-500/40 stroke-amber-500" strokeWidth="1.25" />
      </g>
      <g>
        <circle cx="184" cy="40" r="8" className="fill-sky-500/40 stroke-sky-500" strokeWidth="1.25" />
        <circle cx="184" cy="90" r="8" className="fill-sky-500/40 stroke-sky-500" strokeWidth="1.25" />
      </g>

      <g className="font-mono text-[8px] fill-muted-foreground">
        <text x="36" y="18" textAnchor="middle">target</text>
        <text x="100" y="20" textAnchor="middle">drug</text>
        <text x="184" y="25" textAnchor="middle">moa</text>
      </g>
    </svg>
  );
}

// ─────────────────────────────── Tools card primitives

function ToolCard({
  href,
  icon,
  title,
  body,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary"
          >
            {icon}
          </span>
          {title}
        </div>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </header>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </Link>
  );
}

function ToolFrame({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/60">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
        />
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
        />
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
        />
        <span className="ml-2 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </span>
      </div>
      {children}
    </div>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  contraindicated:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  major:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  moderate:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  minor: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

function InteractionRow({
  pair,
  severity,
}: {
  pair: string;
  severity: keyof typeof SEVERITY_STYLE;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="truncate font-mono text-foreground/80">{pair}</span>
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${SEVERITY_STYLE[severity]}`}
      >
        {severity}
      </span>
    </li>
  );
}

function CompareColumn({
  name,
  klass,
  moa,
  atc,
}: {
  name: string;
  klass: string;
  moa: string;
  atc: string;
}) {
  return (
    <div className="space-y-1.5 p-3">
      <div className="font-semibold">{name}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          class
        </span>
        <span className="truncate">{klass}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          moa
        </span>
        <span className="truncate">{moa}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          atc
        </span>
        <span className="truncate font-mono text-foreground/80">{atc}</span>
      </div>
    </div>
  );
}

function PassageRow({
  drug,
  section,
  score,
}: {
  drug: string;
  section: string;
  score: number;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className="flex-1 truncate">
        <span className="font-mono text-foreground/80">{drug}</span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {section}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="hidden h-1 w-16 overflow-hidden rounded-full bg-foreground/10 sm:block"
      >
        <span
          className="block h-full rounded-full bg-primary/70"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {score.toFixed(2)}
      </span>
    </li>
  );
}

function MatchRow({ slug, score }: { slug: string; score: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-primary">{slug}</span>
      <span className="text-muted-foreground">{score}</span>
    </li>
  );
}

const SEARCH_KIND_STYLE: Record<string, string> = {
  drug: "border-primary/30 bg-primary/10 text-primary",
  brand: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  class: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  atc: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

function SearchRow({
  label,
  kind,
}: {
  label: string;
  kind: keyof typeof SEARCH_KIND_STYLE;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="truncate">{label}</span>
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${SEARCH_KIND_STYLE[kind]}`}
      >
        {kind}
      </span>
    </li>
  );
}

// ─────────────────────────────── Build card primitives

function BuildCard({
  href,
  icon,
  title,
  body,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border/80 bg-background/60 p-5 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary"
          >
            {icon}
          </span>
          {title}
        </div>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </header>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </Link>
  );
}

function CodePreview({
  label,
  scrollable = true,
  children,
}: {
  label: string;
  scrollable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-foreground/5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
      </div>
      <pre
        className={`${scrollable ? "overflow-x-auto" : ""} whitespace-pre p-3 leading-relaxed`}
      >
        {children}
      </pre>
    </div>
  );
}

const VERB_STYLE: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  POST: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

function EndpointRow({ verb, path: p }: { verb: string; path: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${VERB_STYLE[verb] ?? "bg-foreground/10"}`}
      >
        {verb}
      </span>
      <span className="truncate">{p}</span>
    </div>
  );
}

// ─────────────────────────────── Misc

function SurfacePill({
  href,
  icon,
  external,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";
  const content = (
    <>
      <span aria-hidden="true" className="text-primary">
        {icon}
      </span>
      {children}
    </>
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
