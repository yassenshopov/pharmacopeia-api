import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DrugsListClient } from "@/components/drugs-list-client";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

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

export default async function DrugsPage() {
  const { items: drugs, pagination } = await getRepository().listDrugs({
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Drugs" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Drugs</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {pagination.total} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Every entry includes its active ingredient, brand names,
          pharmacological class, indications, and crosswalks to RxNorm,
          DrugBank, ChEMBL, and ATC.
        </p>
      </div>

      <DrugsListClient items={drugs} />
    </div>
  );
}
