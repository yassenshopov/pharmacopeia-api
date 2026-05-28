import type { Metadata } from "next";
import { AtcTreeClient } from "@/components/atc-tree-client";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const ATC_PATH = "/atc";
const ATC_TITLE = "ATC classification";
const ATC_DESCRIPTION =
  "Explore the WHO Anatomical Therapeutic Chemical (ATC) classification as a fully expandable tree, levels 1 through 5, from anatomical main group down to individual substances.";

const LEVEL_LEGEND: { level: number; name: string; dot: string }[] = [
  { level: 1, name: "Anatomical main group", dot: "bg-chart-1" },
  { level: 2, name: "Therapeutic subgroup", dot: "bg-chart-2" },
  { level: 3, name: "Pharmacological subgroup", dot: "bg-chart-4" },
  { level: 4, name: "Chemical subgroup", dot: "bg-chart-5" },
  { level: 5, name: "Substance", dot: "bg-chart-3" },
];

export async function generateMetadata(): Promise<Metadata> {
  const groups = await getRepository().listAtcGroups();
  const subgroupCount = groups.reduce((acc, g) => acc + g.classes.length, 0);
  const ogImage = ogImageUrl({
    title: "ATC classification",
    subtitle: `${groups.length} groups · ${subgroupCount} subgroups`,
  });
  const url = absoluteUrl(ATC_PATH);
  return {
    title: ATC_TITLE,
    description: ATC_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: ATC_TITLE,
      description: ATC_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ATC classification`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ATC_TITLE,
      description: ATC_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function AtcPage() {
  const tree = await getRepository().getAtcTree();
  const groupCount = tree.length;
  const subgroupCount = tree.reduce(
    (acc, l1) =>
      acc +
      l1.children.reduce(
        (a, l2) => a + l2.children.reduce((b, l3) => b + l3.children.length, 0),
        0,
      ),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "ATC" }]} />
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            ATC classification
          </h1>
          <span className="font-mono text-sm text-muted-foreground">
            {groupCount} groups · {subgroupCount} subgroups
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          The WHO Anatomical Therapeutic Chemical system organises drugs across
          five levels — from the broad anatomical main group down to the
          individual chemical substance. Expand any branch to drill from organ
          system to mechanism to molecule. Each chemical subgroup links to its
          class record; each substance links to its drug page.
        </p>
      </div>

      <ul className="mb-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {LEVEL_LEGEND.map((l) => (
          <li key={l.level} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${l.dot}`}
            />
            <span>
              <span className="font-mono text-foreground">L{l.level}</span>{" "}
              {l.name}
            </span>
          </li>
        ))}
      </ul>

      <AtcTreeClient tree={tree} />
    </div>
  );
}
