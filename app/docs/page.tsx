import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Quickstart and endpoint reference for pharmacopeia — an open API for medications.",
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
      "List drug summaries. Supports ?limit, ?offset, and ?class=<slug>.",
  },
  {
    method: "GET",
    path: "/api/v1/drug/{slug}",
    description:
      "Full drug record with mechanism, indications, dosing, PK, identifiers.",
  },
  {
    method: "GET",
    path: "/api/v1/drug/{slug}/interactions",
    description: "All interactions involving the given drug.",
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

export default async function DocsPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
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
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <Badge
                variant={e.method === "GET" ? "secondary" : "default"}
                className="w-fit font-mono text-[10px]"
              >
                {e.method}
              </Badge>
              <code className="font-mono text-sm">{e.path}</code>
              <p className="text-sm text-muted-foreground sm:ml-auto sm:text-right">
                {e.description}
              </p>
            </li>
          ))}
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
    <section id={id} className="mt-14 scroll-mt-24">
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <a
          href={`#${id}`}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          #
        </a>
      </div>
      {children}
      <Separator className="mt-10 opacity-50" />
    </section>
  );
}
