import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import type { DrugClass } from "@/lib/schemas";
import {
  collectionPageJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function classDescription(cls: DrugClass): string {
  const lead = `${cls.name} — ${cls.kind.toUpperCase()} pharmacological class with ${cls.drugCount} drug${cls.drugCount === 1 ? "" : "s"}.`;
  return truncate(cls.description ? `${lead} ${cls.description}` : lead);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cls = await getRepository().getClass(slug);

  if (!cls) {
    return {
      title: "Class not found",
      description:
        "The requested pharmacological class was not found in pharmacopeia.",
      robots: { index: false, follow: false },
    };
  }

  const description = classDescription(cls);
  const url = absoluteUrl(`/classes/${cls.slug}`);
  const ogImage = ogImageUrl({
    title: cls.name,
    subtitle: cls.kind.toUpperCase(),
  });

  return {
    title: cls.name,
    description,
    keywords: [
      cls.name,
      cls.kind,
      cls.code ?? "",
      "drug class",
      "pharmacological class",
    ].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: cls.name,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${cls.name} — ${cls.kind.toUpperCase()} class`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: cls.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const cls = await repo.getClass(slug);
  if (!cls) notFound();

  const { items: drugs } = await repo.listDrugs({
    classSlug: slug,
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            name: `${cls.name} — drugs in this class`,
            description: classDescription(cls),
            url: `/classes/${cls.slug}`,
            items: drugs.map((d) => ({
              name: d.name,
              url: `/drugs/${d.slug}`,
            })),
          }),
        )}
      />

      <Breadcrumbs
        items={[
          { label: "Classes", href: "/classes" },
          { label: cls.name },
        ]}
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            {cls.name}
          </h1>
          {cls.description && (
            <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
              {cls.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono uppercase" translate="no">
              {cls.kind}
            </Badge>
            {cls.code && (
              <Badge variant="outline" className="font-mono" translate="no">
                {cls.code}
              </Badge>
            )}
            {cls.parent && (
              <Link
                href={`/classes/${cls.parent.slug}`}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Badge variant="outline" className="hover:bg-accent">
                  parent · {cls.parent.name}
                </Badge>
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code translate="no">/api/v1/class/{cls.slug}</code>
        </div>
      </div>

      <Separator className="my-10" />

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Drugs in this class ({drugs.length})
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2">
        {drugs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/drugs/${d.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <span className="font-semibold" translate="no">
                {d.name}
              </span>
              {d.shortDescription && (
                <span className="mt-1 text-sm text-muted-foreground">
                  {d.shortDescription}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Try the API
        </h2>
        <CodeBlock
          code={`curl https://pharmacopeia.dev/api/v1/class/${cls.slug}`}
          label="cURL"
          language="bash"
        />
      </div>
    </div>
  );
}
