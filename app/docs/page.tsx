import type { Metadata } from "next";
import Link from "next/link";
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

const STRUCTURE_SEARCH_SAMPLE = `// Paste a SMILES, get the structurally closest drugs
const res = await fetch(
  "https://pharmacopeia.dev/api/v1/structure-search",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      smiles: "CC(=O)NC1=CC=C(C=C1)O",
      limit: 10,
      threshold: 0.4,
    }),
  },
);
const { results } = await res.json();`;

const GRAPHQL_SAMPLE = `// Field-selected query — one round-trip, exactly the shape you want
const res = await fetch("https://pharmacopeia.dev/api/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: \`
      query Metformin {
        drug(slug: "metformin") {
          name
          mechanism { summary targets }
          similar { slug name score }
          interactions { drugB severity description }
        }
      }
    \`,
  }),
});
const { data } = await res.json();`;

const ENDPOINTS: {
  method: "GET" | "POST";
  path: string;
  description: string;
  anchor?: string;
}[] = [
  {
    method: "GET",
    path: "/api/v1/health",
    description:
      "Liveness probe + dataset snapshot version. Tiny envelope for monitors and load balancers.",
  },
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
    path: "/api/v1/atc",
    description:
      "Full WHO ATC hierarchy as a nested tree (levels 1–5) with intermediate group names.",
  },
  {
    method: "GET",
    path: "/api/v1/mechanisms/graph",
    description:
      "Mechanism-of-action network: drugs, MoA classes, and molecular targets as nodes and links.",
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
  {
    method: "POST",
    path: "/api/v1/structure-search",
    description:
      "Paste a SMILES and rank drugs in the dataset by 2D Tanimoto similarity. Body: { smiles, limit?, threshold? }. Structural proximity only.",
    anchor: "structure-search",
  },
  {
    method: "POST",
    path: "/api/graphql",
    description:
      "Field-selected GraphQL surface over the same repository. GET the endpoint in a browser to open GraphiQL.",
    anchor: "graphql",
  },
  {
    method: "GET",
    path: "/api/v1/changelog",
    description:
      "Recent record-level changes (typed mirror of /feed.xml and /feed.json). Supports ?limit and ?since=<ISO-8601>.",
    anchor: "feed",
  },
];

const DOCS_TOC: TocItem[] = [
  { id: "quickstart", label: "Quickstart" },
  { id: "conventions", label: "Conventions" },
  { id: "search", label: "Search" },
  { id: "interactions", label: "Interaction check" },
  { id: "structure-search", label: "Structure search" },
  { id: "graphql", label: "GraphQL" },
  { id: "endpoints", label: "Endpoints" },
  { id: "feed", label: "Change feed (RSS / JSON)" },
  { id: "sdks", label: "SDKs (npm / PyPI)" },
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
            <code>Cache-Control: public, s-maxage=3600</code> and a strong{" "}
            <code>ETag</code>. Send the previous tag back in{" "}
            <code>If-None-Match</code> and you'll get a{" "}
            <code>304 Not Modified</code> with no body.
          </li>
          <li>
            <strong className="text-foreground">OpenAPI + try-it.</strong>{" "}
            Every endpoint is described in the live OpenAPI 3.1 document at{" "}
            <code>
              <Link
                href="/api/v1/openapi.json"
                className="underline-offset-4 hover:underline"
              >
                /api/v1/openapi.json
              </Link>
            </code>{" "}
            and rendered as an interactive reference at{" "}
            <code>
              <Link href="/reference" className="underline-offset-4 hover:underline">
                /reference
              </Link>
            </code>
            .
          </li>
          <li>
            <strong className="text-foreground">LLM-friendly.</strong>{" "}
            A short{" "}
            <code>
              <Link href="/llms.txt" className="underline-offset-4 hover:underline">
                /llms.txt
              </Link>
            </code>{" "}
            index and a long-form{" "}
            <code>
              <Link
                href="/llms-full.txt"
                className="underline-offset-4 hover:underline"
              >
                /llms-full.txt
              </Link>
            </code>{" "}
            follow the{" "}
            <a
              href="https://llmstxt.org/"
              className="underline-offset-4 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              llmstxt.org
            </a>{" "}
            convention.
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

      <Section id="structure-search" title="Structure search">
        <p className="mb-4 text-sm text-muted-foreground">
          Paste a SMILES and rank every drug in the dataset by 2D Tanimoto
          similarity, using the same OpenChemLib 512-bit fingerprint family
          that backs each drug&apos;s structural-analogs list. Use{" "}
          <code>limit</code> to cap the result count and{" "}
          <code>threshold</code> (0–1) to drop weak matches. Try it
          interactively at{" "}
          <a
            href="/structure-search"
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            /structure-search
          </a>
          . Structural proximity only — never therapeutic equivalence.
        </p>
        <CodeBlock
          code={STRUCTURE_SEARCH_SAMPLE}
          label="structure-search"
          language="ts"
        />
      </Section>

      <Section id="graphql" title="GraphQL">
        <p className="mb-4 text-sm text-muted-foreground">
          A thin GraphQL layer over the same repository. Pick exactly the
          fields and relations you need in one query — a drug, its
          mechanism, its interactions, and its structural analogs in a
          single round-trip. Open{" "}
          <a
            href="/api/graphql"
            className="rounded-sm font-mono underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            /api/graphql
          </a>{" "}
          in a browser for the GraphiQL IDE with a worked example.
        </p>
        <CodeBlock code={GRAPHQL_SAMPLE} label="graphql" language="ts" />
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

      <Section id="feed" title="Change feed (RSS / JSON)">
        <p className="mb-4 text-sm text-muted-foreground">
          A public &ldquo;what&rsquo;s new&rdquo; feed of recent record
          changes — new drugs, new endpoints, new ingestion batches — so
          consumers and curators can watch the dataset evolve without
          scraping. Same entries served over RSS 2.0 and{" "}
          <a
            href="https://www.jsonfeed.org/version/1.1/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            JSON Feed 1.1
          </a>
          . Browse the same entries at{" "}
          <Link
            href="/changelog"
            className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            /changelog
          </Link>
          .
        </p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
          <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
            <Badge variant="secondary" className="w-fit font-mono text-[10px]" translate="no">
              GET
            </Badge>
            <code className="break-all font-mono text-sm" translate="no">
              /feed.xml
            </code>
            <p className="text-sm text-muted-foreground sm:ml-auto sm:text-right">
              RSS 2.0 feed. Drop into Feedly, NetNewsWire, or any reader.
            </p>
          </li>
          <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
            <Badge variant="secondary" className="w-fit font-mono text-[10px]" translate="no">
              GET
            </Badge>
            <code className="break-all font-mono text-sm" translate="no">
              /feed.json
            </code>
            <p className="text-sm text-muted-foreground sm:ml-auto sm:text-right">
              JSON Feed 1.1. Each item carries the structured{" "}
              <code>_pharmacopeia</code> extension (kind, action,
              entity slug, sources) for automation.
            </p>
          </li>
        </ul>
      </Section>

      <Section id="sdks" title="SDKs (npm / PyPI)">
        <p className="mb-4 text-sm text-muted-foreground">
          Thin, fully-typed clients so consumers don&rsquo;t hand-roll{" "}
          <code>fetch</code> wrappers. Types are generated from the same
          Zod schemas the API uses, so request and response shapes can
          never silently drift from the server. Tagged releases on GitHub
          publish both packages automatically.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-card/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-sm" translate="no">
                @pharmacopeia/client
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                npm
              </Badge>
            </div>
            <CodeBlock
              code={`npm install @pharmacopeia/client`}
              label="install"
              language="bash"
            />
          </div>
          <div className="rounded-lg border border-border/80 bg-card/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-sm" translate="no">
                pharmacopeia
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                PyPI
              </Badge>
            </div>
            <CodeBlock
              code={`pip install pharmacopeia`}
              label="install"
              language="bash"
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          The full           machine-readable contract — every endpoint, every
          schema — lives at{" "}
          <a
            href="/api/v1/openapi.json"
            className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <code>/api/v1/openapi.json</code>
          </a>{" "}
          if you&rsquo;d rather generate your own client.
        </p>
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
