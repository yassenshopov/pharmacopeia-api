import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Toc, type TocItem } from "@/components/toc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  GLOSSARY_CATEGORY_LABEL,
  GLOSSARY_CATEGORY_ORDER,
  GLOSSARY_TERMS,
  type GlossaryCategory,
} from "@/lib/content/glossary";
import { getRepository } from "@/lib/data/repository";
import {
  articleJsonLd,
  definedTermSetJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const GLOSSARY_PATH = "/glossary";
const GLOSSARY_TITLE = "Glossary";
const GLOSSARY_DESCRIPTION =
  "Plain-language definitions of the pharmacology, chemistry, and data terms used across pharmacopeia — RxCUI, ATC, SMILES, provenance, and more.";

const GLOSSARY_OG_IMAGE = ogImageUrl({
  title: "Glossary",
  subtitle: `${GLOSSARY_TERMS.length} terms defined`,
});

export const metadata: Metadata = {
  title: GLOSSARY_TITLE,
  description: GLOSSARY_DESCRIPTION,
  alternates: { canonical: absoluteUrl(GLOSSARY_PATH) },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: GLOSSARY_TITLE,
    description: GLOSSARY_DESCRIPTION,
    url: absoluteUrl(GLOSSARY_PATH),
    images: [
      {
        url: GLOSSARY_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — glossary of terms`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: GLOSSARY_TITLE,
    description: GLOSSARY_DESCRIPTION,
    images: [GLOSSARY_OG_IMAGE],
  },
};

const GLOSSARY_TOC: TocItem[] = GLOSSARY_CATEGORY_ORDER.filter((category) =>
  GLOSSARY_TERMS.some((term) => term.category === category),
).map((category) => ({
  id: category,
  label: GLOSSARY_CATEGORY_LABEL[category],
}));

export default async function GlossaryPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <script
        {...jsonLdScriptProps([
          articleJsonLd({
            title: GLOSSARY_TITLE,
            description: GLOSSARY_DESCRIPTION,
            url: GLOSSARY_PATH,
            dateModified: stats.updatedAt,
          }),
          definedTermSetJsonLd({
            name: `${SITE_NAME} glossary`,
            description: GLOSSARY_DESCRIPTION,
            url: GLOSSARY_PATH,
            terms: GLOSSARY_TERMS.map((t) => ({
              term: t.term,
              definition: t.definition,
              slug: t.slug,
            })),
          }),
        ])}
      />

      <Breadcrumbs items={[{ label: "Glossary" }]} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <header className="mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">Glossary</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              The identifiers, classification systems, and clinical and data
              terms you&apos;ll meet across pharmacopeia, defined in plain
              language. Definitions are reference-style, never clinical advice.
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {GLOSSARY_TERMS.length} terms
            </p>
          </header>

          {GLOSSARY_TOC.map((entry) => (
            <GlossarySection
              key={entry.id}
              category={entry.id as GlossaryCategory}
            />
          ))}

          <Separator className="mt-16 opacity-50" />
          <p className="mt-6 text-xs text-muted-foreground">
            Definitions are simplified for a developer audience. For
            authoritative wording, follow each entity&apos;s cited source.
          </p>
        </div>
        <Toc items={GLOSSARY_TOC} />
      </div>
    </div>
  );
}

function GlossarySection({ category }: { category: GlossaryCategory }) {
  const terms = GLOSSARY_TERMS.filter((term) => term.category === category);
  if (terms.length === 0) return null;

  const title = GLOSSARY_CATEGORY_LABEL[category];

  return (
    <section
      id={category}
      className="mt-14 scroll-mt-24"
      aria-labelledby={`${category}-title`}
    >
      <div className="mb-5 flex items-baseline gap-2">
        <h2
          id={`${category}-title`}
          className="text-2xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        <a
          href={`#${category}`}
          aria-label={`Permalink to ${title}`}
          className="rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <span aria-hidden="true">#</span>
        </a>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {terms.length}
        </span>
      </div>

      <dl className="divide-y divide-border/60 rounded-lg border border-border/80">
        {terms.map((term) => (
          <div key={term.slug} id={term.slug} className="scroll-mt-24 p-5">
            <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {term.term}
              </h3>
              {term.aka?.map((alias) => (
                <Badge
                  key={alias}
                  variant="outline"
                  className="text-[10px] font-normal text-muted-foreground"
                >
                  {alias}
                </Badge>
              ))}
              <a
                href={`#${term.slug}`}
                aria-label={`Permalink to ${term.term}`}
                className="rounded-sm font-mono text-xs text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <span aria-hidden="true">#</span>
              </a>
            </dt>
            <dd className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {term.definition}
            </dd>
            {term.related && term.related.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {term.related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
