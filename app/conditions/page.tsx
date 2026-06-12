import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConditionsListClient } from "@/components/conditions-list-client";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-params";
import { getRepository } from "@/lib/data/repository";
import { CONDITION_DIRECTORY_DESCRIPTION } from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const PAGE_SIZE = 30;
const CONDITIONS_PATH = "/conditions";
const CONDITIONS_TITLE = "Conditions";
const CONDITIONS_DESCRIPTION =
  "Browse ICD-10-CM conditions joined to the drugs whose labeled indications map to them. Each condition lists the drugs labeled for it and related conditions. A reference reverse index of labeled uses — not a treatment recommendation.";

export async function generateMetadata(): Promise<Metadata> {
  const { pagination } = await getRepository().listConditions({ limit: 1 });
  const ogImage = ogImageUrl({
    title: "Conditions",
    subtitle: `${pagination.total} ICD-10-CM concepts`,
  });
  const url = absoluteUrl(CONDITIONS_PATH);
  return {
    title: CONDITIONS_TITLE,
    description: CONDITIONS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: CONDITIONS_TITLE,
      description: CONDITIONS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — conditions index`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: CONDITIONS_TITLE,
      description: CONDITIONS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function ConditionsPage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { query, page, limit, offset } = parseBrowseParams(
    await searchParams,
    PAGE_SIZE,
  );
  const repo = getRepository();
  const [{ items: conditions, pagination }, { pagination: all }] =
    await Promise.all([
      repo.listConditions({ q: query || undefined, limit, offset }),
      repo.listConditions({ limit: 1 }),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Conditions" }]} />
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Conditions</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {all.total.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          ICD-10-CM concepts joined to the drugs whose labeled indications
          map to them via a conservative public-domain crosswalk. Click
          through to see which drugs are labeled for each condition and the
          related conditions they share.
        </p>
      </div>

      <div
        role="note"
        aria-label="Conditions reference framing"
        className="mb-10 max-w-3xl rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
      >
        <span className="font-semibold">Reference index only. </span>
        {CONDITION_DIRECTORY_DESCRIPTION} A drug appearing under a condition
        means it carries a labeled indication that maps to that ICD-10
        concept — it is <strong>not</strong> a statement that the drug is
        appropriate for any patient. This is not clinical guidance.
      </div>

      <ConditionsListClient
        items={conditions}
        total={pagination.total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
