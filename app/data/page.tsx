import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const DATA_PATH = "/data";
const DATA_TITLE = "Bulk data";
const DATA_DESCRIPTION =
  "Download the whole pharmacopeia corpus as NDJSON — drugs, classes, and ingredients — streamed straight from the same repository the live API reads from. Grab it in one request instead of walking thousands of endpoints.";

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = ogImageUrl({
    title: "Bulk data",
    subtitle: "Downloadable NDJSON dataset dumps",
  });
  const url = absoluteUrl(DATA_PATH);
  return {
    title: DATA_TITLE,
    description: DATA_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: DATA_TITLE,
      description: DATA_DESCRIPTION,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: DATA_TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: DATA_TITLE,
      description: DATA_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function DataPage() {
  const stats = await getRepository().getStats();
  const datasets = [
    {
      name: "drugs",
      record: "Drug",
      count: stats.drugs,
      description: "Full drug records, including per-record provenance.",
    },
    {
      name: "classes",
      record: "DrugClass",
      count: stats.classes,
      description: "Full drug-class records (FDA EPC, WHO ATC, MoA, MeSH).",
    },
    {
      name: "ingredients",
      record: "Ingredient",
      count: stats.ingredients,
      description: "Full active-ingredient records.",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Bulk data" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Bulk data</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The whole corpus, downloadable as{" "}
        <a
          href="https://github.com/ndjson/ndjson-spec"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          NDJSON
        </a>{" "}
        (one JSON record per line). Each dump streams straight from the
        same repository the live API reads from, so it can never disagree
        with the per-record endpoints. Each record matches its schema in{" "}
        <a
          href="/api/v1/openapi.json"
          className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          the OpenAPI document
        </a>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs">
        <Badge variant="outline">{stats.version}</Badge>
        <Badge variant="outline">
          updated {new Date(stats.updatedAt).toISOString().slice(0, 10)}
        </Badge>
      </div>

      <ul className="mt-10 space-y-4">
        {datasets.map((d) => (
          <li
            key={d.name}
            className="rounded-lg border border-border/80 bg-card/40 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">
                <a
                  href={`/api/v1/export?dataset=${d.name}`}
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  download={`pharmacopeia-${d.name}.ndjson`}
                >
                  {d.name}
                </a>
              </h2>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {d.count.toLocaleString()} × <code>{d.record}</code>
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {d.description}
            </p>
            <code className="mt-3 block break-all font-mono text-xs text-muted-foreground">
              GET /api/v1/export?dataset={d.name}
            </code>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Examples
      </h2>
      <div className="mt-4 space-y-4">
        <CodeBlock
          label="Download every drug record"
          language="bash"
          code={`curl -L "https://pharmacopeia.dev/api/v1/export?dataset=drugs" \\
  -o pharmacopeia-drugs.ndjson`}
        />
        <CodeBlock
          label="List the available dumps"
          language="bash"
          code={`curl "https://pharmacopeia.dev/api/v1/export"`}
        />
        <CodeBlock
          label="Stream + filter with jq (slug + name only)"
          language="bash"
          code={`curl -sL "https://pharmacopeia.dev/api/v1/export?dataset=drugs" \\
  | jq -c '{slug, name}'`}
        />
      </div>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Aggregated public-source reference data, educational and
        informational use only. See{" "}
        <a
          href="/docs"
          className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          the docs
        </a>{" "}
        for per-source attribution. Every record carries its own provenance
        block.
      </p>
    </div>
  );
}
