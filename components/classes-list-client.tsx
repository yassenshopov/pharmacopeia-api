"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrowseListShell } from "@/components/browse-list-shell";
import { Badge } from "@/components/ui/badge";
import type { DrugClass } from "@/lib/schemas";

interface ClassesListClientProps {
  /** Current page of server-filtered results. */
  items: DrugClass[];
  /** Total matches for the active query across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** Active server-side `?q=` filter. */
  query: string;
}

export function ClassesListClient({
  items,
  total,
  page,
  pageSize,
  query,
}: ClassesListClientProps) {
  return (
    <BrowseListShell
      basePath="/classes"
      label="classes"
      filterLabel="Filter classes"
      placeholder="Filter classes by name, kind, or description…"
      query={query}
      page={page}
      pageSize={pageSize}
      total={total}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/classes/${c.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 font-semibold">
                    <span className="truncate" translate="no">
                      {c.name}
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
                    {c.slug}
                  </code>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 font-mono text-[10px] uppercase"
                  translate="no"
                >
                  {c.kind}
                </Badge>
              </div>
              {c.description && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {c.description}
                </p>
              )}
              <div className="mt-4 text-xs text-muted-foreground">
                {c.drugCount} {c.drugCount === 1 ? "drug" : "drugs"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </BrowseListShell>
  );
}
