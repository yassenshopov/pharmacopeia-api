import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { ProvenanceBadgeSample } from "@/components/provenance-badge";
import { Toc, type TocItem } from "@/components/toc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import { articleJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const DOCS_PATH = "/docs";
const DOCS_TITLE = "Documentation";
const DOCS_DESCRIPTION =
  "Quickstart and endpoint reference for pharmacopeia — JSON-over-HTTP access to drugs, classes, ingredients, interactions, and search.";

const DOCS_OG_IMAGE = ogImageUrl({
  title: "Documentation",
  subtitle: "API reference",
});

export const metadata: Metadata = {
  title: DOCS_TITLE,
  description: DOCS_DESCRIPTION,
  alternates: { canonical: absoluteUrl(DOCS_PATH) },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: DOCS_TITLE,
    description: DOCS_DESCRIPTION,
    url: absoluteUrl(DOCS_PATH),
    images: [
      {
        url: DOCS_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} documentation`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DOCS_TITLE,
    description: DOCS_DESCRIPTION,
    images: [DOCS_OG_IMAGE],
  },
};

const QUICKSTART = `// Fetch a drug by slug
const res = await fetch("https://pharmacopeia.dev/api/v1/drug/metformin");
const drug = await res.json();
console.log(drug.mechanism.summary);`;

const SEARCH_SAMPLE = `// Search across drugs, ingredients, and classes
fetch("https://pharmacopeia.dev/api/v1/search?q=blood+thinner")
  .then((r) => r.json())
  .then(({ results }) => console.log(results));`;

const INTERACTION_SAMPLE = `// Check pairwise interactions
const res = await fetch(
  "https://pharmacopeia.dev/api/v1/interactions/check",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs: ["lisinopril", "ibuprofen"] }),
  },
);
const { pairs, summary } = await res.json();`;

const ENDPOINTS: {
  method: "GET" | "POST";
  path: string;
  description: string;
  anchor?: string;
}[] = [
  {
    method: "GET",
    path: "/api/v1/stats",
    description: "Top-level counts for the entire dataset and current version.",
  },
  {
    method: "GET",
    path: "/api/v1/drugs",
    description:
      "List drug summaries. Supports ?limit, ?offset, ?class=<slug>, and ?ingredient=<slug>.",
  },
  {
    method: "GET",
    path: "/api/v1/drug/{slug}",
    description:
      "Full drug record: mechanism + targets, indications, contraindications, FDA label sections (boxed warning, dosage, adverse reactions, warnings, special populations, overdosage), PK, approval history, and identifiers.",
  },
  {
    method: "GET",
    path: "/api/v1/drug/{slug}/interactions",
    description: "All interactions involving the given drug.",
  },
  {
    method: "GET",
    path: "/api/v1/drug/{slug}/similar",
    description:
      "Structurally similar drugs, ranked by 2D fingerprint (Tanimoto) similarity over PubChem structures.",
  },
  {
    method: "GET",
    path: "/api/v1/brands",
    description: "Brand → generic crosswalk for every brand name in the dataset.",
  },
  {
    method: "GET",
    path: "/api/v1/classes",
    description: "List pharmacological classes (ATC, EPC, MoA, MeSH).",
  },
  {
    method: "GET",
    path: "/api/v1/class/{slug}",
    description: "Class detail with the list of drugs it contains.",
  },
  {
    method: "GET",
    path: "/api/v1/ingredients",
    description: "List active ingredients with chemistry identifiers.",
  },
  {
    method: "GET",
    path: "/api/v1/ingredient/{slug}",
    description: "Ingredient detail (RxCUI, UNII, SMILES, InChIKey, formula).",
  },
  {
    method: "GET",
    path: "/api/v1/search",
    description: "Search drugs, ingredients, classes by name or synonym.",
    anchor: "search",
  },
  {
    method: "POST",
    path: "/api/v1/interactions/check",
    description:
      "Pairwise interaction check. Body: { drugs: string[] }. Returns severity-graded pairs.",
    anchor: "interactions",
  },
];

const DOCS_TOC: TocItem[] = [
  { id: "quickstart", label: "Quickstart" },
  { id: "conventions", label: "Conventions" },
  { id: "search", label: "Search" },
  { id: "interactions", label: "Interaction check" },
  { id: "endpoints", label: "Endpoints" },
  { id: "indicators", label: "How to read the indicators" },
  { id: "disclaimer", label: "Disclaimer" },
];

export default async function DocsPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <script
        {...jsonLdScriptProps(
          articleJsonLd({
            title: DOCS_TITLE,
            description: DOCS_DESCRIPTION,
            url: DOCS_PATH,
            dateModified: stats.updatedAt,
          }),
        )}
      />

      <Breadcrumbs items={[{ label: "Docs" }]} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight">Docs</h1>
        <p className="mt-3 text-muted-foreground">
          pharmacopeia is a JSON-over-HTTP API. Every response is generated
          and validated by the same Zod schemas used internally, so this page
          is the schema.
        </p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          API version{" "}
          <code className="rounded bg-foreground/5 px-1.5 py-0.5">
            {stats.version}
          </code>{" "}
          · last updated{" "}
          {new Date(stats.updatedAt).toISOString().slice(0, 10)}
        </p>
      </div>

      <Section id="quickstart" title="Quickstart">
        <p className="mb-4 text-sm text-muted-foreground">
          No authentication is required in v0. Rate limits apply.
        </p>
        <CodeBlock code={QUICKSTART} label="get a drug" language="ts" />
      </Section>

      <Section id="conventions" title="Conventions">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Slugs over IDs.</strong> Every
            entity is keyed by a stable, human-readable slug (e.g.{" "}
            <code>metformin</code>). Slugs never change.
          </li>
          <li>
            <strong className="text-foreground">Versioned URLs.</strong> All
            routes live under <code>/api/v1</code>. Breaking changes will
            ship as <code>/api/v2</code>.
          </li>
          <li>
            <strong className="text-foreground">Provenance everywhere.</strong>{" "}
            Every record carries a <code>provenance</code> object with the
            canonical source URL, hash, extractor, and confidence.
          </li>
          <li>
            <strong className="text-foreground">JSON in, JSON out.</strong>{" "}
            Bodies are <code>application/json</code>. Responses are{" "}
            <code>application/json; charset=utf-8</code>.
          </li>
          <li>
            <strong className="text-foreground">Cache-friendly.</strong>{" "}
            <code>GET</code> responses ship with{" "}
            <code>Cache-Control: public, s-maxage=3600</code>.
          </li>
        </ul>
      </Section>

      <Section id="search" title="Search">
        <p className="mb-4 text-sm text-muted-foreground">
          A single <code>q</code> parameter searches across drug names, brand
          names, synonyms, ingredient names, and class names.
        </p>
        <CodeBlock code={SEARCH_SAMPLE} label="search" language="ts" />
      </Section>

      <Section id="interactions" title="Interaction check">
        <p className="mb-4 text-sm text-muted-foreground">
          Send 2–20 drug slugs and get back every known pairwise interaction
          with severity, mechanism, and recommendation. The response includes
          a summary count per severity bucket.
        </p>
        <CodeBlock
          code={INTERACTION_SAMPLE}
          label="interactions/check"
          language="ts"
        />
      </Section>

      <Section id="endpoints" title="Endpoints">
        <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
          {ENDPOINTS.map((e) => (
            <li
              key={`${e.method} ${e.path}`}
              id={e.anchor}
              className="flex flex-col gap-1 scroll-mt-24 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <Badge
                variant={e.method === "GET" ? "secondary" : "default"}
                className="w-fit font-mono text-[10px]"
                translate="no"
              >
                {e.method}
              </Badge>
              <code className="break-all font-mono text-sm" translate="no">
                {e.path}
              </code>
              <p className="text-sm text-muted-foreground sm:ml-auto sm:text-right">
                {e.description}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="indicators" title="How to read the indicators">
        <p className="mb-5 text-sm text-muted-foreground">
          Every field on every page is tagged with the pipeline that
          produced it. The badges below tell you at a glance how much
          trust to extend before you act on a sentence. Hover or focus
          any live badge to see the underlying extractor, confidence,
          and source URL.
        </p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
          <li className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-5">
            <ProvenanceBadgeSample kind="ai-extracted" label="AI-extracted" />
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                AI-extracted.
              </span>{" "}
              An LLM produced or rewrote this content. Read critically
              and cross-check against the linked source. Used for any
              extractor starting with <code>llm-</code>,{" "}
              <code>claude-</code>, <code>gpt-</code>,{" "}
              <code>gemini-</code>, or <code>mistral-</code>.
            </div>
          </li>
          <li className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-5">
            <ProvenanceBadgeSample
              kind="auto-sourced"
              label="Sourced from openFDA"
            />
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                Auto-sourced.
              </span>{" "}
              A script fetched this directly from a structured,
              authoritative source — humans wrote the words, our
              pipeline just shipped them. Used for{" "}
              <code>openfda</code>, <code>dailymed</code>,{" "}
              <code>rxnav</code>, <code>drugbank-open</code>,{" "}
              <code>atc-who</code>, and any <code>ingest-script@*</code>.
            </div>
          </li>
          <li className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-5">
            <span
              role="img"
              aria-label="No badge: curated by a maintainer"
              className="inline-flex h-5 items-center rounded-full border border-dashed border-border px-2 text-[10px] font-medium text-muted-foreground/60"
            >
              no badge
            </span>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                Curated.
              </span>{" "}
              A maintainer typed this by hand. No badge is rendered —
              default trust — but the underlying{" "}
              <code>provenance</code> is still in the JSON payload.
            </div>
          </li>
        </ul>
      </Section>

      <Section id="disclaimer" title="Disclaimer">
        <p className="text-sm text-muted-foreground">
          pharmacopeia is for educational and informational use only.
          Nothing in the API or this site is medical advice, a diagnosis, a
          treatment recommendation, or a substitute for consultation with a
          qualified clinician. Always verify against the canonical{" "}
          <code>provenance.sourceUrl</code> before acting on any field.
        </p>
      </Section>
        </div>
        <Toc items={DOCS_TOC} />
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <a
          href={`#${id}`}
          aria-label={`Permalink to ${title}`}
          className="rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <span aria-hidden="true">#</span>
        </a>
      </div>
      {children}
      <Separator className="mt-10 opacity-50" />
    </section>
  );
}
