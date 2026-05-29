import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, Network } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import type { Reaction } from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function reactionDescription(r: Reaction): string {
  const lead = `${r.name} (MedDRA Preferred Term) — ${r.drugCount} drug${r.drugCount === 1 ? "" : "s"} in the dataset report this reaction with ${r.totalReports.toLocaleString()} total FAERS reports.`;
  return truncate(`${lead} Reference statistics only — not a symptom checker.`);
}

/**
 * Format `count / drugTotalReports` as a short percentage suitable for
 * a tabular cell. Mirrors the helper on the drug detail page so the
 * two surfaces agree on framing edge cases (denominator missing,
 * sub-0.1% share). Returns `"—"` when share is null, signalling that
 * the upstream FAERS totals query failed during ingest and we can't
 * honestly compute a percentage.
 */
function formatShare(share: number | null): string {
  if (share === null) return "—";
  const pct = share * 100;
  if (pct === 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

function formatSimilarity(value: number): string {
  if (value >= 0.995) return "≈1.00";
  return value.toFixed(2);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const reaction = await getRepository().getReaction(slug);

  if (!reaction) {
    return {
      title: "Reaction not found",
      description:
        "The requested reaction was not found in the pharmacopeia dataset.",
      robots: { index: false, follow: false },
    };
  }

  const description = reactionDescription(reaction);
  const url = absoluteUrl(`/reactions/${reaction.slug}`);
  const ogImage = ogImageUrl({
    title: reaction.name,
    subtitle: `FAERS reaction · ${reaction.drugCount} drugs`,
  });

  return {
    title: reaction.name,
    description,
    keywords: [
      reaction.name,
      ...reaction.aliases,
      "MedDRA",
      "FAERS",
      "adverse event reporting",
      "drug reaction reference",
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: reaction.name,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${reaction.name} — FAERS reaction reference`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: reaction.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function ReactionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();

  // Alias slugs (American spellings) 301-redirect to canonical to keep
  // search engines from treating Diarrhoea/Diarrhea as duplicate pages.
  const resolved = await repo.resolveReactionSlug(slug);
  if (!resolved) notFound();
  if (resolved.matched !== resolved.canonical) {
    permanentRedirect(`/reactions/${resolved.canonical}`);
  }

  const reaction = await repo.getReaction(resolved.canonical);
  if (!reaction) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Reactions", href: "/reactions" },
          { label: reaction.name },
        ]}
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-balance text-4xl font-semibold tracking-tight"
            translate="no"
          >
            {reaction.name}
          </h1>
          {reaction.aliases.length > 0 && (
            <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">also: </span>
              <span translate="no">{reaction.aliases.join(", ")}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {reaction.drugCount}{" "}
              {reaction.drugCount === 1 ? "drug" : "drugs"}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {reaction.totalReports.toLocaleString()} FAERS reports
            </Badge>
            <Badge
              variant="secondary"
              className="font-mono text-[10px]"
              title="MedDRA Preferred Term"
            >
              MedDRA PT
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code translate="no">/api/v1/reaction/{reaction.slug}</code>
        </div>
      </div>

      <div
        role="note"
        aria-label="FAERS reference framing"
        className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
      >
        <span className="font-semibold">Reference statistics only. </span>
        FAERS reports are <em>voluntarily submitted</em> and are{" "}
        <strong>not</strong> incidence rates, safety signals, or causal
        evidence. The drugs below are ranked by how often this reaction
        appears on FAERS reports for each drug — high share does{" "}
        <strong>not</strong> mean the drug caused the reaction, and
        absence from this list does <strong>not</strong> mean the
        reaction never occurred. This is not a symptom checker.
      </div>

      <Separator className="my-10" />

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {reaction.meta && (
            <section aria-labelledby="definition-title">
              <h2
                id="definition-title"
                className="mb-3 flex items-baseline justify-between gap-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <span>Definition</span>
                <a
                  href={reaction.meta.meshBrowserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Full MeSH record for ${reaction.meta.meshDescriptorName} (opens in a new tab)`}
                  className="inline-flex items-center gap-1 rounded-sm text-[10px] normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  NLM MeSH {reaction.meta.meshDescriptorId}
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </a>
              </h2>
              <blockquote
                cite={reaction.meta.meshBrowserUrl}
                className="rounded-md border-l-2 border-border bg-card/30 px-4 py-3 text-sm leading-relaxed text-foreground/90"
              >
                {reaction.meta.scopeNote}
              </blockquote>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Source:{" "}
                <a
                  href={reaction.meta.meshBrowserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  U.S. National Library of Medicine — MeSH (
                  {reaction.meta.meshDescriptorName})
                </a>
              </p>
            </section>
          )}

          <section aria-labelledby="drugs-title">
            <h2
              id="drugs-title"
              className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Drugs reporting {reaction.name} ({reaction.drugs.length})
            </h2>
            <p className="mb-4 text-xs italic text-muted-foreground">
              Share = reports listing this reaction ÷ total matched
              reports for the drug. <span className="not-italic">—</span>{" "}
              means the upstream totals query failed at ingest and the
              denominator is unknown.
            </p>
            <ol className="space-y-1">
              {reaction.drugs.map((d, i) => (
                <li
                  key={d.drug}
                  className="flex items-baseline justify-between gap-3 rounded-sm border-b border-border/40 px-1 py-1.5 text-sm last:border-b-0"
                >
                  <span className="flex items-baseline gap-3 min-w-0">
                    <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <Link
                      href={`/drugs/${d.drug}#adverse-events`}
                      className="truncate rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                      translate="no"
                    >
                      {d.name}
                    </Link>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                    <span aria-label={`${d.count.toLocaleString()} reports`}>
                      {d.count.toLocaleString()}
                    </span>
                    <span
                      className="w-12 text-right text-foreground/80"
                      aria-label={`${formatShare(d.share)} of matched reports`}
                    >
                      {formatShare(d.share)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {reaction.relatedReactions.length > 0 && (
            <section aria-labelledby="related-title">
              <h2
                id="related-title"
                className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <Network aria-hidden="true" className="h-3.5 w-3.5" />
                Related reactions
              </h2>
              <p className="mb-4 text-xs italic text-muted-foreground">
                Other reactions most often co-reported on the same drug
                set. Ranked by Jaccard similarity over drug-id sets —
                pure data-derived co-occurrence, not a clinical
                relationship.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {reaction.relatedReactions.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/reactions/${r.slug}`}
                      className="group flex items-baseline justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    >
                      <span className="truncate" translate="no">
                        {r.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {r.sharedDrugs} shared · {formatSimilarity(r.similarity)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reaction.meta && reaction.meta.references.length > 0 && (
            <section aria-labelledby="literature-title">
              <h2
                id="literature-title"
                className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                Literature
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Recent PubMed references pinned to{" "}
                <span translate="no">{reaction.meta.meshDescriptorName}</span>{" "}
                as a MeSH major topic. About the reaction term itself —
                not about any specific drug.
              </p>
              <ul className="space-y-3">
                {reaction.meta.references.map((ref) => (
                  <li
                    key={ref.pmid}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <a
                      href={ref.pubmedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {ref.title}
                    </a>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <em>{ref.journal}</em>
                      <span className="tabular-nums"> · {ref.year}</span>
                      {ref.authors.length > 0 && (
                        <>
                          <span> · </span>
                          <span>
                            {ref.authors.join(", ")}
                            {ref.authors.length >= 3 ? ", et al." : ""}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                      <span translate="no">PMID {ref.pmid}</span>
                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                          translate="no"
                        >
                          DOI {ref.doi}
                        </a>
                      )}
                    </div>
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
                {reaction.name}
              </span>{" "}
              is a{" "}
              <a
                href="https://www.meddra.org/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MedDRA terminology (opens in a new tab)"
                className="inline-flex items-center gap-0.5 rounded-sm text-foreground/90 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                MedDRA
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>{" "}
              Preferred Term reported on FAERS adverse-event
              submissions. Each entry below is one drug from the
              dataset whose FAERS reports mention this reaction.
            </p>
          </Section>

          {reaction.meta && (
            <Section title="MeSH descriptor">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
                <KV
                  label="ID"
                  value={reaction.meta.meshDescriptorId}
                />
                <KV
                  label="Name"
                  value={reaction.meta.meshDescriptorName}
                />
                {reaction.meta.meshEntryTerms.length > 0 && (
                  <KV
                    label="Synonyms"
                    value={reaction.meta.meshEntryTerms.join(", ")}
                  />
                )}
                <KV
                  label="Tree"
                  value={reaction.meta.treeNumbers.join(", ")}
                />
              </dl>
              {reaction.meta.parents.length > 0 && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sits under
                  </p>
                  <ul className="space-y-1 text-xs">
                    {reaction.meta.parents.map((p) => (
                      <li key={p.uid} className="flex items-baseline gap-2">
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/mesh/${p.uid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${p.name} on NLM MeSH (opens in a new tab)`}
                          className="inline-flex min-w-0 items-baseline gap-1 truncate rounded-sm text-foreground/90 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                          translate="no"
                        >
                          <span className="truncate">{p.name}</span>
                          <ArrowUpRight
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <a
                href={reaction.meta.meshBrowserUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Full MeSH record on NLM (opens in a new tab)"
                className="mt-3 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                Full MeSH record
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>
            </Section>
          )}

          <Section title="Try the API">
            <CodeBlock
              code={`curl https://pharmacopeia.dev/api/v1/reaction/${reaction.slug}`}
              label="cURL"
              language="bash"
            />
          </Section>

          <Section title="Source">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
              <KV label="Source" value="openFDA · FAERS" />
              <KV label="Coding" value="MedDRA Preferred Term" />
              <KV
                label="Aliases"
                value={
                  reaction.aliases.length > 0
                    ? reaction.aliases.join(", ")
                    : "—"
                }
              />
            </dl>
            <a
              href="https://open.fda.gov/data/faers/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="openFDA FAERS dataset (opens in a new tab)"
              className="mt-3 inline-flex items-center gap-1 rounded-sm break-all text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              open.fda.gov/data/faers/
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          </Section>
        </aside>
      </div>

      <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note. </span>
        {reaction.disclaimer}
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
