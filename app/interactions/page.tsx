import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { InteractionsChecker } from "@/components/interactions-checker";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const INTERACTIONS_PATH = "/interactions";
const INTERACTIONS_TITLE = "Interaction check";
const INTERACTIONS_DESCRIPTION =
  "Pick a set of drugs and check them pairwise for known interactions, severity-graded, with a one-sided narrative fallback per drug.";

const SAMPLE_CURL = `curl -X POST https://pharmacopeia.dev/api/v1/interactions/check \\
  -H "Content-Type: application/json" \\
  -d '{"drugs": ["lisinopril", "ibuprofen"]}'`;

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = ogImageUrl({
    title: "Interaction check",
    subtitle: "POST /api/v1/interactions/check",
  });
  const url = absoluteUrl(INTERACTIONS_PATH);
  return {
    title: INTERACTIONS_TITLE,
    description: INTERACTIONS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: INTERACTIONS_TITLE,
      description: INTERACTIONS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — interaction checker`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: INTERACTIONS_TITLE,
      description: INTERACTIONS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function InteractionsPage() {
  const repo = getRepository();
  // First grid page only — the checker filters server-side from there.
  const [{ items: drugs }, narrativeSlugs, stats] = await Promise.all([
    repo.listDrugs({ limit: 24 }),
    repo.listInteractionNarrativeSlugs(),
    repo.getStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: "Interactions" }]} />

      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            Interaction check
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Pick a set of drugs and we&apos;ll look for pairwise interactions
            in the dataset, severity-graded, with a per-drug narrative
            fallback for what isn&apos;t in the pair-graph yet.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {stats.drugs.toLocaleString()} drugs available ·{" "}
            {narrativeSlugs.length.toLocaleString()} carry an openFDA
            narrative · {stats.interactions} curated pairs
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">POST</div>
          <code translate="no">/api/v1/interactions/check</code>
        </div>
      </div>

      <InteractionsChecker drugs={drugs} narrativeSlugs={narrativeSlugs} />

      <section className="mt-14 rounded-lg border border-border/60 bg-card/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Why is the pair-graph empty?
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Real drug-drug interactions are expensive to license. The free
          public source most apps used to call — NIH RxNav&apos;s{" "}
          <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
            /interaction
          </code>{" "}
          API — was retired in 2024 when its Truven license expired. The
          remaining free option is the verbatim &ldquo;Drug Interactions&rdquo;
          section of each openFDA label, which is one-sided narrative text
          (drug × everything), not a structured{" "}
          <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
            (drugA, drugB)
          </code>{" "}
          row.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          v0 keeps the pair-graph schema and the POST endpoint in place —
          the moment a structured DDI source becomes available
          (DrugBank partnership, ANSM file, etc.), the same UI you&apos;re
          looking at starts returning real pairs. Until then, follow the{" "}
          <Link
            href="/drugs"
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            drug detail
          </Link>{" "}
          pages for the one-sided narratives.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Try the API
        </h2>
        <CodeBlock code={SAMPLE_CURL} label="cURL" language="bash" />
      </section>

      <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note. </span>
        Interaction data on pharmacopeia is illustrative and incomplete.
        Educational and informational use only — never use this surface
        to make a clinical decision. Always verify against the canonical
        source linked from each record&apos;s provenance.
      </div>
    </div>
  );
}
