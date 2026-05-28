import Link from "next/link";
import { ArrowRight, FlaskConical, Layers, Pill, Search } from "lucide-react";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import {
  getRepository,
  type SearchResult,
} from "@/lib/data/repository";
import { absoluteUrl, SITE_NAME } from "@/lib/seo/site";

const SEARCH_PATH = "/search";
const MAX_RESULTS = 50;

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function getQuery(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return (raw ?? "").trim();
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = getQuery(sp.q);
  const title = q ? `Search · ${q}` : "Search";
  const description = q
    ? `Search results for "${q}" — drugs, classes, and ingredients in the ${SITE_NAME} reference API.`
    : `Search the ${SITE_NAME} reference API for drugs, pharmacological classes, and active ingredients.`;
  const url = q
    ? absoluteUrl(`${SEARCH_PATH}?q=${encodeURIComponent(q)}`)
    : absoluteUrl(SEARCH_PATH);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

type Kind = SearchResult["kind"];

const KIND_META: Record<
  Kind,
  { label: string; href: (slug: string) => string; Icon: typeof Pill }
> = {
  drug: { label: "Drugs", href: (slug) => `/drugs/${slug}`, Icon: Pill },
  class: { label: "Classes", href: (slug) => `/classes/${slug}`, Icon: Layers },
  ingredient: {
    label: "Ingredients",
    href: (slug) => `/ingredients/${slug}`,
    Icon: FlaskConical,
  },
};

const KIND_ORDER: Kind[] = ["drug", "class", "ingredient"];

const SUGGESTIONS: { name: string; slug: string; kind: Kind }[] = [
  { name: "metformin", slug: "metformin", kind: "drug" },
  { name: "sertraline", slug: "sertraline", kind: "drug" },
  { name: "atorvastatin", slug: "atorvastatin", kind: "drug" },
  { name: "ACE inhibitors", slug: "ace-inhibitors", kind: "class" },
  { name: "SSRIs", slug: "ssris", kind: "class" },
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = getQuery(sp.q);

  const results = q
    ? await getRepository().search(q, MAX_RESULTS)
    : [];

  const grouped: Record<Kind, SearchResult[]> = {
    drug: [],
    class: [],
    ingredient: [],
  };
  for (const r of results) {
    grouped[r.kind]?.push(r);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Search" }]} />

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Search</h1>
        {q ? (
          <p className="text-muted-foreground">
            Results for{" "}
            <span className="font-mono text-foreground">&ldquo;{q}&rdquo;</span>
            {" — "}
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
        ) : (
          <p className="max-w-2xl text-muted-foreground">
            Search drugs, pharmacological classes, and active ingredients. Try
            a generic name, brand name, ATC code, or class.
          </p>
        )}
      </header>

      <form
        action={SEARCH_PATH}
        method="GET"
        role="search"
        className="mb-12 flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="search-q" className="sr-only">
          Search query
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="metformin, ACE inhibitor, sertraline…"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          Search
        </button>
      </form>

      {!q && (
        <section aria-labelledby="suggestions-heading">
          <h2
            id="suggestions-heading"
            className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Suggestions
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => {
              const { Icon } = KIND_META[s.kind];
              return (
                <li key={`${s.kind}:${s.slug}`}>
                  <Link
                    href={KIND_META[s.kind].href(s.slug)}
                    className="group flex items-center gap-3 rounded-lg border border-border/80 bg-card/40 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <span className="font-medium">{s.name}</span>
                    <code
                      className="text-xs text-muted-foreground"
                      translate="no"
                    >
                      {s.slug}
                    </code>
                    <Badge
                      variant="outline"
                      className="ml-auto font-mono text-[10px] uppercase"
                    >
                      {s.kind}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {q && results.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No matches for{" "}
            <span className="font-mono text-foreground">&ldquo;{q}&rdquo;</span>
            . Try a different name, brand, or class.
          </p>
        </div>
      )}

      {q && results.length > 0 && (
        <div className="flex flex-col gap-10">
          {KIND_ORDER.map((kind) => {
            const items = grouped[kind];
            if (items.length === 0) return null;
            const meta = KIND_META[kind];
            const { Icon } = meta;
            return (
              <section
                key={kind}
                aria-labelledby={`group-${kind}-heading`}
                className="flex flex-col gap-3"
              >
                <h2
                  id={`group-${kind}-heading`}
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {meta.label}
                  <span className="font-mono normal-case text-muted-foreground/60">
                    · {items.length}
                  </span>
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {items.map((r) => (
                    <li key={`${r.kind}:${r.slug}`}>
                      <Link
                        href={meta.href(r.slug)}
                        className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 font-semibold">
                              <span className="truncate" translate="no">
                                {r.name}
                              </span>
                              <ArrowRight
                                aria-hidden="true"
                                className="h-3.5 w-3.5 shrink-0 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none"
                              />
                            </div>
                            <code
                              className="block truncate text-xs text-muted-foreground"
                              translate="no"
                            >
                              {r.slug}
                            </code>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 font-mono text-[10px] uppercase"
                          >
                            {kind}
                          </Badge>
                        </div>
                        {r.description && (
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                            {r.description}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
