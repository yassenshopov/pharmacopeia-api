import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const ATC_PATH = "/atc";
const ATC_TITLE = "ATC classification";
const ATC_DESCRIPTION =
  "Browse the WHO Anatomical Therapeutic Chemical (ATC) classification by anatomical main group. Each subgroup links to its class record and the drugs it contains.";

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
  const groups = await getRepository().listAtcGroups();
  const subgroupCount = groups.reduce((acc, g) => acc + g.classes.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "ATC" }]} />
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            ATC classification
          </h1>
          <span className="font-mono text-sm text-muted-foreground">
            {groups.length} groups · {subgroupCount} subgroups
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          The WHO Anatomical Therapeutic Chemical system organises drugs by the
          organ system they act on and their therapeutic and chemical
          properties. Top-level anatomical groups are shown below; each subgroup
          present in the dataset links to its full class record.
        </p>
      </div>

      <nav
        aria-label="Jump to anatomical group"
        className="mb-10 flex flex-wrap gap-2"
      >
        {groups.map((g) => (
          <a
            key={g.letter}
            href={`#atc-${g.letter}`}
            className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-card/40 px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <span className="font-mono font-semibold text-primary">
              {g.letter}
            </span>
            <span className="text-muted-foreground">{g.classes.length}</span>
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {groups.map((g) => (
          <section
            key={g.letter}
            id={`atc-${g.letter}`}
            aria-labelledby={`atc-${g.letter}-title`}
            className="scroll-mt-20"
          >
            <div className="mb-4 flex items-baseline gap-3 border-b border-border/60 pb-2">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 font-mono text-sm font-semibold text-primary"
              >
                {g.letter}
              </span>
              <h2
                id={`atc-${g.letter}-title`}
                className="text-lg font-semibold tracking-tight"
              >
                {g.name}
              </h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.classes.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/classes/${c.slug}`}
                    className="group flex h-full items-start justify-between gap-3 rounded-lg border border-border/80 bg-card/40 p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {c.drugCount} {c.drugCount === 1 ? "drug" : "drugs"}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px]"
                      translate="no"
                    >
                      {c.code}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
