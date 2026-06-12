import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReactionsListClient } from "@/components/reactions-list-client";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-params";
import { getRepository } from "@/lib/data/repository";
import { REACTION_DIRECTORY_DESCRIPTION } from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const PAGE_SIZE = 30;
const REACTIONS_PATH = "/reactions";
const REACTIONS_TITLE = "Reactions";
const REACTIONS_DESCRIPTION =
  "Browse MedDRA Preferred Terms reported to FAERS across the drug dataset. Each reaction lists the drugs that report it, ranked by share of the drug's matched reports. Reference statistics only — not a symptom checker.";

export async function generateMetadata(): Promise<Metadata> {
  const { pagination } = await getRepository().listReactions({ limit: 1 });
  const ogImage = ogImageUrl({
    title: "Reactions",
    subtitle: `${pagination.total} MedDRA Preferred Terms`,
  });
  const url = absoluteUrl(REACTIONS_PATH);
  return {
    title: REACTIONS_TITLE,
    description: REACTIONS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: REACTIONS_TITLE,
      description: REACTIONS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — reactions index`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: REACTIONS_TITLE,
      description: REACTIONS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function ReactionsPage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { query, page, limit, offset } = parseBrowseParams(
    await searchParams,
    PAGE_SIZE,
  );
  const repo = getRepository();
  const [{ items: reactions, pagination }, { pagination: all }] =
    await Promise.all([
      repo.listReactions({ q: query || undefined, limit, offset }),
      repo.listReactions({ limit: 1 }),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Reactions" }]} />
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Reactions</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {all.total.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          MedDRA Preferred Terms reported to FAERS across the dataset.
          Click through to see which drugs report each reaction most
          often, along with related reactions ranked by co-occurrence.
        </p>
      </div>

      <div
        role="note"
        aria-label="FAERS reference framing"
        className="mb-10 max-w-3xl rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
      >
        <span className="font-semibold">Reference statistics only. </span>
        {REACTION_DIRECTORY_DESCRIPTION} Counts reflect reporting
        volume — how often a reaction was <em>reported</em> on FAERS
        submissions, not how often it occurs in the population. Empty
        entries do not mean &ldquo;no reactions&rdquo;. For
        decision-grade use, consult openFDA and the FAERS Public
        Dashboard directly.
      </div>

      <ReactionsListClient
        items={reactions}
        total={pagination.total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
