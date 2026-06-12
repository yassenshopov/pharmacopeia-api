import { Ban, CheckCircle2, Circle, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import {
  ROADMAP_ITEMS,
  roadmapStats,
  type RoadmapItem,
  type RoadmapKind,
  type RoadmapStatus,
} from "@/lib/roadmap/items";
import { articleJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";
import { cn } from "@/lib/utils";

const ROADMAP_PATH = "/roadmap";
const ROADMAP_TITLE = "Roadmap";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const DATE_FORMATTER_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

function formatDateShort(iso: string): string {
  return DATE_FORMATTER_SHORT.format(new Date(iso));
}

const KIND_LABEL: Record<RoadmapKind, string> = {
  platform: "Platform",
  data: "Data",
  ui: "UI",
  api: "API",
  seo: "SEO",
  a11y: "Accessibility",
  docs: "Docs",
  devx: "DevX",
  research: "Research",
};

// Stable kind ordering used inside each section so the same kind always
// renders in the same slot regardless of section.
const KIND_ORDER: RoadmapKind[] = [
  "platform",
  "data",
  "api",
  "ui",
  "seo",
  "a11y",
  "docs",
  "devx",
  "research",
];

const STATS = roadmapStats();
const LAST_SHIPPED_AT = ROADMAP_ITEMS.filter((i) => i.shippedAt)
  .map((i) => i.shippedAt as string)
  .sort()
  .at(-1);

const ROADMAP_DESCRIPTION = `What we've shipped, what we're building right now, and what's queued. ${STATS.shipped} shipped, ${STATS.inProgress} in progress, ${STATS.next + STATS.later} planned, ${STATS.exploring} exploring.`;

const ROADMAP_OG_IMAGE = ogImageUrl({
  title: "Roadmap",
  subtitle: `${STATS.shipped} shipped · ${STATS.inProgress + STATS.next} planned`,
});

export const metadata: Metadata = {
  title: ROADMAP_TITLE,
  description: ROADMAP_DESCRIPTION,
  alternates: { canonical: absoluteUrl(ROADMAP_PATH) },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: ROADMAP_TITLE,
    description: ROADMAP_DESCRIPTION,
    url: absoluteUrl(ROADMAP_PATH),
    images: [
      {
        url: ROADMAP_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — roadmap and changelog`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ROADMAP_TITLE,
    description: ROADMAP_DESCRIPTION,
    images: [ROADMAP_OG_IMAGE],
  },
};

interface SectionConfig {
  id: string;
  title: string;
  subtitle: string;
  status: RoadmapStatus;
  sortByDateDesc?: boolean;
  emphasized?: boolean;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "in-progress",
    title: "In progress",
    subtitle: "What we're actively building right now.",
    status: "in-progress",
    emphasized: true,
  },
  {
    id: "next",
    title: "Next",
    subtitle: "Committed for the next milestone.",
    status: "next",
  },
  {
    id: "shipped",
    title: "Shipped",
    subtitle: "The changelog — what's done, with dates.",
    status: "shipped",
    sortByDateDesc: true,
  },
  {
    id: "later",
    title: "Later",
    subtitle: "Planned, but not scheduled.",
    status: "later",
  },
  {
    id: "exploring",
    title: "Exploring",
    subtitle: "Open questions, ideas, prototypes.",
    status: "exploring",
  },
];

export default async function RoadmapPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <script
        {...jsonLdScriptProps(
          articleJsonLd({
            title: ROADMAP_TITLE,
            description: ROADMAP_DESCRIPTION,
            url: ROADMAP_PATH,
            dateModified: stats.updatedAt,
            ...(LAST_SHIPPED_AT
              ? {
                  datePublished: new Date(LAST_SHIPPED_AT).toISOString(),
                }
              : {}),
          }),
        )}
      />

      <Breadcrumbs items={[{ label: "Roadmap" }]} />

      <header className="mb-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-4xl font-semibold tracking-tight">Roadmap</h1>
          <span
            className="font-mono text-sm text-muted-foreground"
            translate="no"
          >
            {stats.version}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The changelog and the backlog, in one place. Everything below is
          rendered from a single typed file, so adding a new entry is one
          append, not a JSX edit.
        </p>
        {LAST_SHIPPED_AT ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last shipped{" "}
            <time dateTime={LAST_SHIPPED_AT} className="tabular-nums">
              {formatDate(LAST_SHIPPED_AT)}
            </time>
            {" · "}
            <a
              href="#shipped"
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Jump to changelog
            </a>
          </p>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Shipped" value={STATS.shipped} sublabel="v0" />
        <StatCard
          label="In progress"
          value={STATS.inProgress}
          sublabel="Active now"
        />
        <StatCard label="Next" value={STATS.next} sublabel="Committed" />
        <StatCard label="Later" value={STATS.later} sublabel="Planned" />
      </div>

      {SECTIONS.map((section) => (
        <RoadmapSection
          key={section.id}
          config={section}
          items={ROADMAP_ITEMS.filter((i) => i.status === section.status)}
        />
      ))}

      <Separator className="mt-16 opacity-50" />
      <p className="mt-6 text-xs text-muted-foreground">
        Educational and informational use only. Dates on planned items
        are best-effort targets, not commitments.
      </p>
    </div>
  );
}

function RoadmapSection({
  config,
  items,
}: {
  config: SectionConfig;
  items: RoadmapItem[];
}) {
  if (items.length === 0) return null;

  const grouped = groupByKind(items, config.sortByDateDesc);

  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className={cn("mt-14 scroll-mt-24", config.emphasized && "mt-12")}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h2
          id={`${config.id}-title`}
          className={cn(
            "text-2xl font-semibold tracking-tight",
            config.emphasized && "text-3xl",
          )}
        >
          {config.title}
        </h2>
        <a
          href={`#${config.id}`}
          aria-label={`Permalink to ${config.title}`}
          className="rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <span aria-hidden="true">#</span>
        </a>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{config.subtitle}</p>

      <div className="space-y-8">
        {grouped.map(({ kind, items: kindItems }) => (
          <div key={kind}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {KIND_LABEL[kind]}
            </h3>
            <TimelineList items={kindItems} />
          </div>
        ))}
      </div>
    </section>
  );
}

function groupByKind(
  items: RoadmapItem[],
  sortByDateDesc = false,
): { kind: RoadmapKind; items: RoadmapItem[] }[] {
  const byKind = new Map<RoadmapKind, RoadmapItem[]>();
  for (const item of items) {
    const arr = byKind.get(item.kind);
    if (arr) arr.push(item);
    else byKind.set(item.kind, [item]);
  }

  if (sortByDateDesc) {
    for (const arr of byKind.values()) {
      arr.sort((a, b) => {
        const da = a.shippedAt ?? a.startedAt ?? a.targetAt ?? "";
        const db = b.shippedAt ?? b.startedAt ?? b.targetAt ?? "";
        return db.localeCompare(da);
      });
    }
  }

  return KIND_ORDER.filter((k) => byKind.has(k)).map((kind) => ({
    kind,
    items: byKind.get(kind) as RoadmapItem[],
  }));
}

function TimelineList({ items }: { items: RoadmapItem[] }) {
  return (
    <ul className="relative space-y-5 border-l border-border/60 pl-6">
      {items.map((item) => (
        <TimelineItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

function TimelineItem({ item }: { item: RoadmapItem }) {
  return (
    <li id={item.id} className="relative scroll-mt-24">
      <span
        aria-hidden="true"
        className="absolute -left-[calc(1.5rem+0.5px)] top-0.5 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-background"
      >
        <StatusIcon status={item.status} blocked={Boolean(item.blocked)} />
      </span>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4
          className={cn(
            "text-sm font-medium leading-snug text-foreground",
            item.status === "exploring" && "italic text-muted-foreground",
            item.status === "later" && "text-muted-foreground",
          )}
        >
          {item.title}
        </h4>
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider"
        >
          {KIND_LABEL[item.kind]}
        </Badge>
        {item.blocked ? (
          <Badge
            variant="outline"
            className="gap-1 border-rose-500/40 bg-rose-500/10 text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300"
          >
            <Ban aria-hidden="true" className="h-3 w-3" />
            Blocked
          </Badge>
        ) : null}
        {item.milestone ? (
          <Badge
            variant="ghost"
            className="font-mono text-[10px] text-muted-foreground"
            translate="no"
          >
            {item.milestone}
          </Badge>
        ) : null}
        <StatusSuffix item={item} />
      </div>

      {item.body ? (
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {item.body}
        </p>
      ) : null}

      {item.blocked ? (
        <p className="mt-2 max-w-prose rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            Blocked:
          </span>{" "}
          {item.blocked}
        </p>
      ) : null}

      {item.tags && item.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {item.tags.map((tag) => (
            <li key={tag}>
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-muted-foreground"
                translate="no"
              >
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {item.links && item.links.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs">
          {item.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {link.label} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function StatusIcon({
  status,
  blocked = false,
}: {
  status: RoadmapStatus;
  blocked?: boolean;
}) {
  if (blocked) {
    return <Ban className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
  }
  switch (status) {
    case "shipped":
      return (
        <CheckCircle2
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.25}
        />
      );
    case "in-progress":
      return (
        <span
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
      );
    case "next":
      return <Circle className="h-3.5 w-3.5 text-foreground/70" />;
    case "later":
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    case "exploring":
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusSuffix({ item }: { item: RoadmapItem }) {
  if (item.status === "shipped" && item.shippedAt) {
    return (
      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
        ✓ Shipped{" "}
        <time dateTime={item.shippedAt} className="tabular-nums">
          {formatDate(item.shippedAt)}
        </time>
      </span>
    );
  }
  if (item.status === "in-progress" && item.startedAt) {
    return (
      <span className="font-mono text-[11px] text-primary">
        Started{" "}
        <time dateTime={item.startedAt} className="tabular-nums">
          {formatDateShort(item.startedAt)}
        </time>
      </span>
    );
  }
  if (
    (item.status === "next" || item.status === "later") &&
    item.targetAt
  ) {
    return (
      <span className="font-mono text-[11px] text-muted-foreground">
        Target{" "}
        <time dateTime={item.targetAt} className="tabular-nums">
          {formatDateShort(item.targetAt)}
        </time>
      </span>
    );
  }
  return null;
}
