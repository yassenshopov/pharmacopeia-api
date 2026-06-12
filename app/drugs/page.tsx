import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DrugsListClient } from "@/components/drugs-list-client";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-params";
import { getRepository } from "@/lib/data/repository";
import { SEED_STRUCTURES } from "@/lib/data/seed/structures";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const PAGE_SIZE = 24;

const DRUGS_PATH = "/drugs";
const DRUGS_TITLE = "Drugs";
const DRUGS_DESCRIPTION =
  "Browse every medication in the pharmacopeia. Each drug carries mechanism, indications, dosing, identifiers (RxNorm, ATC, DrugBank), and per-record provenance.";

export async function generateMetadata(): Promise<Metadata> {
  const { pagination } = await getRepository().listDrugs({ limit: 1 });
  const ogImage = ogImageUrl({
    title: "Drugs",
    subtitle: `${pagination.total} medications`,
  });
  const url = absoluteUrl(DRUGS_PATH);
  return {
    title: DRUGS_TITLE,
    description: DRUGS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: DRUGS_TITLE,
      description: DRUGS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — drugs index`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DRUGS_TITLE,
      description: DRUGS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function DrugsPage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { query, page, limit, offset } = parseBrowseParams(
    await searchParams,
    PAGE_SIZE,
  );
  const repo = getRepository();
  const [{ items: drugs, pagination }, stats] = await Promise.all([
    repo.listDrugs({ q: query || undefined, limit, offset }),
    repo.getStats(),
  ]);
  const structureSlugs = Object.keys(SEED_STRUCTURES);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Drugs" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Drugs</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {stats.drugs.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Every entry includes its active ingredient, brand names,
          pharmacological class, indications, and crosswalks to RxNorm,
          DrugBank, ChEMBL, and ATC.
        </p>
      </div>

      <DrugsListClient
        items={drugs}
        total={pagination.total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
        structureSlugs={structureSlugs}
      />
    </div>
  );
}
