import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BrandsListClient } from "@/components/brands-list-client";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const BRANDS_PATH = "/brands";
const BRANDS_TITLE = "Brand names";
const BRANDS_DESCRIPTION =
  "Brand → generic crosswalk. Look up a marketed brand name and pivot straight to the generic drug record, with mechanism, dosing, and identifiers.";

export async function generateMetadata(): Promise<Metadata> {
  const brands = await getRepository().listBrands();
  const ogImage = ogImageUrl({
    title: "Brand names",
    subtitle: `${brands.length} brand → generic links`,
  });
  const url = absoluteUrl(BRANDS_PATH);
  return {
    title: BRANDS_TITLE,
    description: BRANDS_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: BRANDS_TITLE,
      description: BRANDS_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — brand names`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: BRANDS_TITLE,
      description: BRANDS_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function BrandsPage() {
  const brands = await getRepository().listBrands();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Brands" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Brand names</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {brands.length} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Brand → generic crosswalk built from RxNorm brand concepts. Land on a
          brand and jump straight to the generic drug record. Brand names are US
          market examples and are not exhaustive.
        </p>
      </div>

      <BrandsListClient items={brands} />
    </div>
  );
}
