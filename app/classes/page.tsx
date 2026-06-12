import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClassesListClient } from "@/components/classes-list-client";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-params";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const PAGE_SIZE = 24;
const CLASSES_PATH = "/classes";
const CLASSES_TITLE = "Drug classes";
const CLASSES_DESCRIPTION =
  "Browse pharmacological classes — WHO ATC, FDA EPC, mechanism of action, and MeSH. Each class lists every drug it contains, with codes and parents.";

export async function generateMetadata(): Promise<Metadata> {
  const { pagination } = await getRepository().listClasses({ limit: 1 });
  const ogImage = ogImageUrl({
    title: "Drug classes",
    subtitle: `${pagination.total} classifications`,
  });
  const url = absoluteUrl(CLASSES_PATH);
  return {
    title: CLASSES_TITLE,
    description: CLASSES_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: CLASSES_TITLE,
      description: CLASSES_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — drug classes`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: CLASSES_TITLE,
      description: CLASSES_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { query, page, limit, offset } = parseBrowseParams(
    await searchParams,
    PAGE_SIZE,
  );
  const repo = getRepository();
  const [{ items: classes, pagination }, stats] = await Promise.all([
    repo.listClasses({ q: query || undefined, limit, offset }),
    repo.getStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Classes" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Classes</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {stats.classes.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Pharmacological classifications from RxClass (FDA EPC, WHO ATC, MoA,
          MeSH). Each class lists the drugs that belong to it.
        </p>
      </div>

      <ClassesListClient
        items={classes}
        total={pagination.total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
