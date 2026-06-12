import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { IngredientsListClient } from "@/components/ingredients-list-client";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-params";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const PAGE_SIZE = 24;
const INGREDIENTS_PATH = "/ingredients";
const INGREDIENTS_TITLE = "Ingredients";
const INGREDIENTS_DESCRIPTION =
  "Browse every active pharmaceutical ingredient — RxCUI, UNII, molecular formula, InChIKey, and the drugs that contain each substance.";

export async function generateMetadata(): Promise<Metadata> {
  const { pagination } = await getRepository().listIngredients({ limit: 1 });
  const ogImage = ogImageUrl({
    title: "Ingredients",
    subtitle: `${pagination.total} active substances`,
  });
  const url = absoluteUrl(INGREDIENTS_PATH);
  return {
    title: INGREDIENTS_TITLE,
    description: INGREDIENTS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: INGREDIENTS_TITLE,
      description: INGREDIENTS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ingredients index`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: INGREDIENTS_TITLE,
      description: INGREDIENTS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { query, page, limit, offset } = parseBrowseParams(
    await searchParams,
    PAGE_SIZE,
  );
  const repo = getRepository();
  const [{ items: ingredients, pagination }, stats] = await Promise.all([
    repo.listIngredients({ q: query || undefined, limit, offset }),
    repo.getStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Ingredients" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Ingredients</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {stats.ingredients.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Active pharmaceutical ingredients with crosswalks to RxNorm,
          UNII, and PubChem chemistry. Click through to see every drug
          that contains a substance.
        </p>
      </div>

      <IngredientsListClient
        items={ingredients}
        total={pagination.total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
