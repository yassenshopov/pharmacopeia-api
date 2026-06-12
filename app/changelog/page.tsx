import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Rss } from "lucide-react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChangelogThumb } from "@/components/changelog-thumb";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";
import type { ChangelogAction, ChangelogEntry, ChangelogKind } from "@/lib/schemas";
import { articleJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * Public HTML rendering of the "what's new" feed. Same entries the RSS
 * and JSON feeds advertise — same `listChangelog()` call — so the three
 * surfaces stay in lockstep.
 */

export const dynamic = "force-static";
export const revalidate = 3600;

const CHANGELOG_PATH = "/changelog";
const CHANGELOG_TITLE = "Changelog";
const CHANGELOG_DESCRIPTION =
  "Recent record changes to the pharmacopeia dataset and API. Subscribe via RSS or JSON Feed to watch the dataset evolve without scraping.";

const CHANGELOG_OG_IMAGE = ogImageUrl({
  title: "Changelog",
  subtitle: "What's new in pharmacopeia",
});

export const metadata: Metadata = {
  title: CHANGELOG_TITLE,
  description: CHANGELOG_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl(CHANGELOG_PATH),
    types: {
      "application/rss+xml": absoluteUrl("/feed.xml"),
      "application/feed+json": absoluteUrl("/feed.json"),
    },
  },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: CHANGELOG_TITLE,
    description: CHANGELOG_DESCRIPTION,
    url: absoluteUrl(CHANGELOG_PATH),
    images: [
      {
        url: CHANGELOG_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — changelog`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: CHANGELOG_TITLE,
    description: CHANGELOG_DESCRIPTION,
    images: [CHANGELOG_OG_IMAGE],
  },
};

const KIND_LABEL: Record<ChangelogKind, string> = {
  drug: "Drug",
  class: "Class",
  ingredient: "Ingredient",
  interaction: "Interaction",
  structure: "Structure",
  dataset: "Dataset",
  endpoint: "Endpoint",
};

const ACTION_COLOR: Record<ChangelogAction, string> = {
  added: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  updated: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  removed: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  released: "border-primary/40 bg-primary/10 text-primary",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FORMATTER.format(d);
}

function isoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default async function ChangelogPage() {
  const entries = await getRepository().listChangelog({ limit: 100 });
  const updatedAt = entries[0]?.timestamp ?? new Date().toISOString();

  const grouped = groupByDay(entries);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script
        {...jsonLdScriptProps(
          articleJsonLd({
            title: CHANGELOG_TITLE,
            description: CHANGELOG_DESCRIPTION,
            url: CHANGELOG_PATH,
            dateModified: updatedAt,
          }),
        )}
      />

      <Breadcrumbs items={[{ label: "Changelog" }]} />

      <header className="mb-10">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          What&rsquo;s new
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
          A running record of notable dataset and API changes. Subscribe with
          your reader of choice — RSS for legacy clients, JSON Feed for
          anything modern — to watch the dataset evolve without scraping.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a
            href="/feed.xml"
            className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Subscribe via RSS"
          >
            <Rss aria-hidden="true" className="h-3.5 w-3.5" />
            RSS
          </a>
          <a
            href="/feed.json"
            className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Subscribe via JSON Feed"
          >
            <span aria-hidden="true" className="font-mono text-[10px]">{`{ }`}</span>
            JSON Feed
          </a>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No changelog entries yet.
        </p>
      ) : (
        <div className="space-y-12">
          {grouped.map((group) => (
            <section key={group.day} aria-labelledby={`day-${group.day}`}>
              <h2
                id={`day-${group.day}`}
                className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <time dateTime={group.day}>{formatDate(group.day)}</time>
              </h2>
              <ul className="space-y-4">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <article className="flex gap-4 rounded-lg border border-border/80 bg-card/40 p-5">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${ACTION_COLOR[entry.action]}`}
          >
            {entry.action}
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {KIND_LABEL[entry.kind]}
          </Badge>
          <time
            dateTime={entry.timestamp}
            className="ml-auto font-mono text-[10px] text-muted-foreground"
          >
            {new Date(entry.timestamp).toISOString().slice(0, 10)}
          </time>
        </div>

        <h3 className="text-lg font-semibold leading-tight">
          <Link
            href={entry.url}
            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {entry.title}
          </Link>
        </h3>

        <p className="mt-2 text-pretty text-sm text-foreground/90">
          {entry.summary}
        </p>

        {(entry.sources.length > 0 || entry.tags.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[10px]"
              >
                {tag}
              </span>
            ))}
            {entry.sources.length > 0 && (
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {entry.sources.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm text-[11px] transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Source: ${hostOf(src)} (opens in new tab)`}
                  >
                    {hostOf(src)}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                  </a>
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      <ChangelogThumb
        kind={entry.kind}
        action={entry.action}
        id={entry.id}
        className="hidden sm:grid"
      />
    </article>
  );
}

interface DayGroup {
  day: string;
  entries: ChangelogEntry[];
}

function groupByDay(entries: ChangelogEntry[]): DayGroup[] {
  const groups = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const day = isoDate(entry.timestamp);
    const list = groups.get(day) ?? [];
    list.push(entry);
    groups.set(day, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([day, list]) => ({ day, entries: list }));
}
