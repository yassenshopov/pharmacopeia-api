"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrowseListShell } from "@/components/browse-list-shell";
import { Badge } from "@/components/ui/badge";
import type { ReactionSummary } from "@/lib/schemas";

interface ReactionsListClientProps {
  /** Current page of server-filtered results. */
  items: ReactionSummary[];
  /** Total matches for the active query across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** Active server-side `?q=` filter. */
  query: string;
}

/**
 * Compact reaction tile. Density matters here — there are hundreds of
 * reactions in the index, and most users scan vertically. Drugs/reports
 * badges share a single row so the card stays scannable.
 */
export function ReactionsListClient({
  items,
  total,
  page,
  pageSize,
  query,
}: ReactionsListClientProps) {
  return (
    <BrowseListShell
      basePath="/reactions"
      label="reactions"
      filterLabel="Filter reactions"
      placeholder="Filter reactions by MedDRA term, alias, or slug…"
      query={query}
      page={page}
      pageSize={pageSize}
      total={total}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/reactions/${r.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
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
                  className="shrink-0 font-mono text-[10px]"
                >
                  {r.drugCount} {r.drugCount === 1 ? "drug" : "drugs"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {r.totalReports.toLocaleString()} reports
                </span>
                {r.aliases.length > 0 && (
                  <span
                    className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px]"
                    translate="no"
                    title={`Also: ${r.aliases.join(", ")}`}
                  >
                    also: {r.aliases[0]}
                    {r.aliases.length > 1 ? ` +${r.aliases.length - 1}` : ""}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </BrowseListShell>
  );
}
