import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  ComparisonGrid,
  comparisonColumnsClass,
  PairInteractions,
  type ComparisonColumn,
} from "@/components/comparison-grid";
import {
  comparePairSlug,
  curatedComparisonPairs,
  parseComparePairSlug,
} from "@/lib/data/comparisons";
import { getRepository } from "@/lib/data/repository";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { loadStructureSvg } from "@/lib/data/structure-svg";
import type { Drug } from "@/lib/schemas";
import {
  collectionPageJsonLd,
  jsonLdScriptProps,
  medicalWebPageJsonLd,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * Indexable, static two-drug comparison page — `/compare/{a}-vs-{b}`.
 *
 * "metformin vs glipizide" is a real, high-volume query, and our
 * structured records make the contrast cheap to render well. The set of
 * pages that exist (and land in the sitemap) is owned by
 * `lib/data/comparisons.ts`; this route renders them and 308-redirects
 * any non-canonical slug order to the canonical one so a pair is never
 * served from two URLs.
 *
 * Strictly a reference contrast, never a recommendation.
 */

// Only the curated marquee pairs are pre-rendered at build time; the
// full pair universe (advertised in the sitemap) renders on demand and
// is then cached, so a 5,000-drug dataset never forces tens of
// thousands of build-time DB round-trips.
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ pair: string }>;
}

export function generateStaticParams(): { pair: string }[] {
  return curatedComparisonPairs().map((p) => ({ pair: p.slug }));
}

async function resolvePair(
  pair: string,
): Promise<{ a: Drug; b: Drug } | null> {
  const parsed = parseComparePairSlug(pair);
  if (!parsed) return null;
  const repo = getRepository();
  const [a, b] = await Promise.all([
    repo.getDrug(parsed.a),
    repo.getDrug(parsed.b),
  ]);
  if (!a || !b) return null;
  return { a, b };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { pair } = await params;
  const resolved = await resolvePair(pair);
  if (!resolved) {
    return {
      title: "Comparison not found",
      description: "The requested drug comparison was not found.",
      robots: { index: false, follow: false },
    };
  }
  const { a, b } = resolved;
  const title = `${a.name} vs ${b.name}`;
  const sharedClass = a.classes.find((c) =>
    b.classes.some((d) => d.slug === c.slug),
  );
  const description = `Compare ${a.name} and ${b.name} side by side: class, mechanism of action, labeled indications, identifiers, and 2D chemical structure${
    sharedClass ? ` — both ${sharedClass.name.toLowerCase()}` : ""
  }. Reference contrast only, not medical advice.`;
  const url = absoluteUrl(`/compare/${comparePairSlug(a.slug, b.slug)}`);
  const ogImage = ogImageUrl({
    title: `${a.name} vs ${b.name}`,
    subtitle: sharedClass?.name ?? "Side-by-side reference",
  });

  return {
    title,
    description,
    keywords: [
      `${a.name} vs ${b.name}`,
      `${a.name} ${b.name} comparison`,
      a.name,
      b.name,
      ...(sharedClass ? [sharedClass.name] : []),
      "drug comparison",
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

async function toColumn(drug: Drug): Promise<ComparisonColumn> {
  const structure = getSeedStructure(drug.slug);
  const structureSvg = structure
    ? await loadStructureSvg(structure.structureSvgPath)
    : null;
  return { slug: drug.slug, drug, structure, structureSvg };
}

export default async function ComparePairPage({ params }: PageProps) {
  const { pair } = await params;
  const parsed = parseComparePairSlug(pair);
  if (!parsed) notFound();

  const canonical = comparePairSlug(parsed.a, parsed.b);
  if (canonical !== pair) redirect(`/compare/${canonical}`);

  const resolved = await resolvePair(pair);
  if (!resolved) notFound();
  const { a, b } = resolved;
  const repo = getRepository();

  const [columnA, columnB, interactionCheck, relatedPeers] = await Promise.all([
    toColumn(a),
    toColumn(b),
    repo.checkInteractions([a.slug, b.slug]),
    relatedComparisons(a, b),
  ]);
  const columns = [columnA, columnB];

  const pairUrl = `/compare/${canonical}`;
  const heading = `${a.name} vs ${b.name}`;
  const sharedClass = a.classes.find((c) =>
    b.classes.some((d) => d.slug === c.slug),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script
        {...jsonLdScriptProps([
          medicalWebPageJsonLd({
            name: heading,
            description: `Side-by-side reference comparison of ${a.name} and ${b.name}.`,
            url: pairUrl,
          }),
          collectionPageJsonLd({
            name: heading,
            description: `${a.name} and ${b.name} compared across class, mechanism, indications, and chemistry.`,
            url: pairUrl,
            items: [
              { name: a.name, url: `/drugs/${a.slug}` },
              { name: b.name, url: `/drugs/${b.slug}` },
            ],
          }),
        ])}
      />

      <Breadcrumbs
        items={[
          { label: "Compare", href: "/compare" },
          { label: heading },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          <span translate="no">{a.name}</span> vs{" "}
          <span translate="no">{b.name}</span>
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
          A side-by-side reference contrast of{" "}
          <Link
            href={`/drugs/${a.slug}`}
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            translate="no"
          >
            {a.name}
          </Link>{" "}
          and{" "}
          <Link
            href={`/drugs/${b.slug}`}
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            translate="no"
          >
            {b.name}
          </Link>
          {sharedClass ? (
            <>
              {" "}
              — both are{" "}
              <Link
                href={`/classes/${sharedClass.slug}`}
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {sharedClass.name}
              </Link>
            </>
          ) : null}
          . Data is taken verbatim from each record — never a recommendation
          that one is better than the other.
        </p>
      </header>

      <div className="space-y-10">
        {interactionCheck.pairs.length > 0 && (
          <PairInteractions interactions={interactionCheck.pairs} />
        )}

        <ComparisonGrid
          columns={columns}
          columnsClass={comparisonColumnsClass(columns.length)}
        />

        {relatedPeers.length > 0 && (
          <section aria-labelledby="related-compare-title">
            <h2
              id="related-compare-title"
              className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              More comparisons
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {relatedPeers.map((rel) => (
                <li key={rel.slug}>
                  <Link
                    href={`/compare/${rel.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    <span className="truncate" translate="no">
                      {rel.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Note. </span>
          Side-by-side data is taken verbatim from each drug record.
          pharmacopeia is for educational and informational use only and is
          not a substitute for professional medical advice.
        </div>
      </div>
    </div>
  );
}

/**
 * A handful of adjacent comparisons that share a class with either drug
 * in the current pair — pure internal-linking fuel so crawlers can walk
 * the comparison graph and readers can pivot to neighbouring contrasts.
 */
async function relatedComparisons(
  a: Drug,
  b: Drug,
): Promise<{ slug: string; label: string }[]> {
  const repo = getRepository();
  const currentSlug = comparePairSlug(a.slug, b.slug);
  const out: { slug: string; label: string }[] = [];
  const seen = new Set<string>([currentSlug]);

  for (const anchor of [a, b]) {
    const classSlug = anchor.classes[0]?.slug;
    if (!classSlug) continue;
    const { items } = await repo.listDrugs({ classSlug, limit: 12 });
    for (const peer of items) {
      if (peer.slug === anchor.slug) continue;
      const slug = comparePairSlug(anchor.slug, peer.slug);
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, label: `${anchor.name} vs ${peer.name}` });
      if (out.length >= 8) return out;
    }
  }
  return out;
}
