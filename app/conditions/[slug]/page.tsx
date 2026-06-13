import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Network } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import type { Condition } from "@/lib/schemas";
import {
  collectionPageJsonLd,
  jsonLdScriptProps,
  medicalWebPageJsonLd,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function conditionDescription(c: Condition): string {
  const lead = `${c.name} (ICD-10-CM ${c.icd10}) — ${c.drugCount} drug${c.drugCount === 1 ? "" : "s"} in the dataset carry a labeled indication mapping to this condition.`;
  return truncate(`${lead} Reference reverse index of labeled uses — not a treatment recommendation.`);
}

function formatSimilarity(value: number): string {
  if (value >= 0.995) return "≈1.00";
  return value.toFixed(2);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const condition = await getRepository().getCondition(slug);

  if (!condition) {
    return {
      title: "Condition not found",
      description:
        "The requested condition was not found in the pharmacopeia dataset.",
      robots: { index: false, follow: false },
    };
  }

  const description = conditionDescription(condition);
  const url = absoluteUrl(`/conditions/${condition.slug}`);
  const ogImage = ogImageUrl({
    title: condition.name,
    subtitle: `ICD-10 ${condition.icd10} · ${condition.drugCount} drugs`,
  });

  return {
    title: condition.name,
    description,
    keywords: [
      condition.name,
      condition.icd10,
      "ICD-10-CM",
      condition.category,
      "indications",
      "drugs for",
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: condition.name,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${condition.name} — ICD-10-CM condition reference`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: condition.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function ConditionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const condition = await repo.getCondition(slug);
  if (!condition) notFound();
  const stats = await repo.getStats();
  const conditionUrl = `/conditions/${condition.slug}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <script
        {...jsonLdScriptProps([
          medicalWebPageJsonLd({
            name: `${condition.name} — drugs labeled for this condition`,
            description: conditionDescription(condition),
            url: conditionUrl,
            lastReviewed: stats.updatedAt,
          }),
          collectionPageJsonLd({
            name: `Drugs labeled for ${condition.name}`,
            description: `Medications whose FDA-labeled indications map to ${condition.name} (ICD-10-CM ${condition.icd10}).`,
            url: conditionUrl,
            items: condition.drugs.map((d) => ({
              name: d.name,
              url: `/drugs/${d.slug}`,
            })),
          }),
        ])}
      />

      <Breadcrumbs
        items={[
          { label: "Conditions", href: "/conditions" },
          { label: condition.name },
        ]}
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            {condition.name}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
            {condition.category}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="font-mono text-[10px]"
              title="ICD-10-CM code"
              translate="no"
            >
              ICD-10 {condition.icd10}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {condition.drugCount}{" "}
              {condition.drugCount === 1 ? "drug" : "drugs"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code translate="no">/api/v1/condition/{condition.slug}</code>
        </div>
      </div>

      <div
        role="note"
        aria-label="Conditions reference framing"
        className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
      >
        <span className="font-semibold">Reference index only. </span>
        Each drug below carries an FDA-labeled indication that maps to{" "}
        <span translate="no">{condition.icd10}</span> via a conservative
        crosswalk. This is <strong>not</strong> a treatment recommendation,
        a formulary, or a statement that any listed drug is appropriate for
        any patient — and the crosswalk is deliberately precision-biased, so
        absence does <strong>not</strong> mean a drug is not indicated.
      </div>

      <Separator className="my-10" />

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="drugs-title">
            <h2
              id="drugs-title"
              className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Drugs labeled for {condition.name} ({condition.drugs.length})
            </h2>
            <ul className="space-y-2">
              {condition.drugs.map((d) => (
                <li
                  key={d.slug}
                  className="rounded-md border border-border/60 bg-card/30 px-3 py-2"
                >
                  <Link
                    href={`/drugs/${d.slug}`}
                    className="rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    translate="no"
                  >
                    {d.name}
                  </Link>
                  <ul className="mt-1 space-y-0.5">
                    {d.indications.map((text, i) => (
                      <li
                        key={i}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {condition.relatedConditions.length > 0 && (
            <section aria-labelledby="related-title">
              <h2
                id="related-title"
                className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <Network aria-hidden="true" className="h-3.5 w-3.5" />
                Related conditions
              </h2>
              <p className="mb-4 text-xs italic text-muted-foreground">
                Conditions most often co-labeled across the same drug set.
                Ranked by Jaccard similarity over drug-id sets — pure
                data-derived co-occurrence, not a clinical relationship.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {condition.relatedConditions.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/conditions/${r.slug}`}
                      className="group flex items-baseline justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {r.sharedDrugs} shared · {formatSimilarity(r.similarity)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          <Section title="What this is">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {condition.name}
              </span>{" "}
              is an{" "}
              <a
                href={`https://www.icd10data.com/search?s=${encodeURIComponent(condition.icd10)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ICD-10-CM code lookup (opens in a new tab)"
                className="inline-flex items-center gap-0.5 rounded-sm text-foreground/90 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                ICD-10-CM
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>{" "}
              concept. Each entry is one drug from the dataset whose
              FDA-labeled indications map to this code.
            </p>
          </Section>

          <Section title="Try the API">
            <CodeBlock
              code={`curl https://pharmacopeia.dev/api/v1/condition/${condition.slug}`}
              label="cURL"
              language="bash"
            />
          </Section>

          <Section title="Source">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
              <KV label="Code" value={condition.icd10} />
              <KV label="Chapter" value={condition.category} />
              <KV label="Crosswalk" value="ICD-10-CM (public domain)" />
            </dl>
          </Section>
        </aside>
      </div>

      <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note. </span>
        {condition.disclaimer}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-mono text-xs" translate="no">
        {value}
      </dd>
    </>
  );
}
