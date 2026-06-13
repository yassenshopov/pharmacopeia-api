import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CompareDrugPicker } from "@/components/compare-drug-picker";
import {
  ComparisonGrid,
  comparisonColumnsClass,
  PairInteractions,
  type ComparisonColumn,
} from "@/components/comparison-grid";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { loadStructureSvg } from "@/lib/data/structure-svg";
import { getRepository } from "@/lib/data/repository";
import type { Drug } from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * Side-by-side drug comparison view.
 *
 * Reads 2–3 drug slugs from `?drugs=a,b,c` and renders them as columns
 * across the canonical reference axes — identity, classes, mechanism,
 * indications, identifiers, structure. Strictly a reference contrast,
 * never a recommendation: the page intentionally avoids language like
 * "better than" or "preferred over".
 *
 * This is the interactive picker surface. Curated, indexable two-drug
 * contrasts live at `/compare/{a}-vs-{b}` (see `app/compare/[pair]`).
 */

// The page is driven by `?drugs=…` query params, so it must render
// dynamically. `force-static` would force `searchParams` to be empty,
// breaking the picker (URL changes but the comparison never updates)
// and producing "Router action dispatched before initialization" when
// the client picker calls `router.replace`.
export const dynamic = "force-dynamic";

const MAX_DRUGS = 3;
const COMPARE_PATH = "/compare";

interface PageProps {
  searchParams: Promise<{ drugs?: string | string[] }>;
}

function parseSlugs(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const flat = Array.isArray(raw) ? raw.join(",") : raw;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of flat.split(/[,\s]+/)) {
    const slug = part.trim().toLowerCase();
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_DRUGS) break;
  }
  return out;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const slugs = parseSlugs((await searchParams).drugs);
  const repo = getRepository();
  const drugs = (
    await Promise.all(slugs.map((s) => repo.getDrug(s)))
  ).filter((d): d is Drug => d !== null);

  const baseTitle = "Side-by-side drug comparison";
  const title = drugs.length > 0
    ? `Compare ${drugs.map((d) => d.name).join(" vs ")}`
    : baseTitle;
  const description =
    drugs.length > 0
      ? `Class, mechanism, indications, identifiers, and 2D structure for ${drugs
          .map((d) => d.name)
          .join(", ")} — side by side.`
      : "Put two or three drugs next to each other and contrast their class, mechanism, indications, identifiers, and chemistry.";

  const url = absoluteUrl(
    drugs.length > 0
      ? `${COMPARE_PATH}?drugs=${drugs.map((d) => d.slug).join(",")}`
      : COMPARE_PATH,
  );
  const ogImage = ogImageUrl({
    title: drugs.length > 0 ? title : baseTitle,
    subtitle:
      drugs.length > 0
        ? drugs.map((d) => d.slug).join(" · ")
        : "Reference contrast",
  });

  return {
    title: drugs.length > 0 ? title : baseTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: drugs.length > 0 ? title : baseTitle,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: drugs.length > 0 ? title : baseTitle,
      description,
      images: [ogImage],
    },
  };
}

/** Suggested starting comparisons, shown only when all slugs resolve. */
const SAMPLE_COMPARISONS: readonly string[][] = [
  ["metformin", "glipizide"],
  ["lisinopril", "losartan"],
  ["atorvastatin", "rosuvastatin", "simvastatin"],
  ["sertraline", "fluoxetine", "escitalopram"],
];

export default async function ComparePage({ searchParams }: PageProps) {
  const slugs = parseSlugs((await searchParams).drugs);
  const repo = getRepository();

  const [resolved, sampleResolution] = await Promise.all([
    Promise.all(
      slugs.map(async (slug) => {
        const drug = await repo.getDrug(slug);
        if (!drug) return { slug, drug: null, structure: null, structureSvg: null };
        const structure = getSeedStructure(slug);
        const structureSvg = structure
          ? await loadStructureSvg(structure.structureSvgPath)
          : null;
        return { slug, drug, structure, structureSvg };
      }),
    ),
    repo.getDrugsBatch(SAMPLE_COMPARISONS.flat()),
  ]);
  const sampleSlugs = new Set(sampleResolution.found.map((d) => d.slug));
  const samples = SAMPLE_COMPARISONS.filter((pair) =>
    pair.every((slug) => sampleSlugs.has(slug)),
  );

  const known = resolved.filter(
    (r): r is ComparisonColumn => r.drug !== null,
  );
  const missing = resolved.filter((r) => r.drug === null).map((r) => r.slug);

  const pairInteractions =
    known.length >= 2
      ? (
          await repo.checkInteractions(known.map((k) => k.drug.slug))
        ).pairs
      : [];

  const columnsClass = comparisonColumnsClass(known.length);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: "Compare" }]} />

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            Compare drugs
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
            Put two or three records next to each other and contrast their
            class, mechanism, indications, identifiers, and chemistry. Reads
            straight from the existing drug records — a reference contrast,
            never a recommendation.
          </p>
        </div>
      </div>

      <CompareDrugPicker
        selected={known.map((k) => ({ slug: k.drug.slug, name: k.drug.name }))}
        maxDrugs={MAX_DRUGS}
      />

      {missing.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          Could not resolve: {missing.map((m) => (
            <code key={m} className="ml-1 font-mono text-xs">{m}</code>
          ))}
        </div>
      )}

      {known.length === 0 ? (
        <EmptyState samples={samples} />
      ) : (
        <div className="mt-10 space-y-10">
          {pairInteractions.length > 0 && (
            <PairInteractions interactions={pairInteractions} />
          )}

          <ComparisonGrid columns={known} columnsClass={columnsClass} />

          <DisclaimerNote />
        </div>
      )}
    </div>
  );
}

function EmptyState({ samples }: { samples: readonly string[][] }) {
  const sample = samples;

  return (
    <div className="mt-10 rounded-lg border border-border/60 bg-card/40 p-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Try one of these
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {sample.map((pair) => (
          <li key={pair.join("-")}>
            <Link
              href={`/compare?drugs=${pair.join(",")}`}
              className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="font-mono text-sm" translate="no">
                {pair.join(" vs ")}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisclaimerNote() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Note. </span>
      Side-by-side data is taken verbatim from each drug record. pharmacopeia
      is for educational and informational use only and is not a substitute
      for professional medical advice.
    </div>
  );
}
