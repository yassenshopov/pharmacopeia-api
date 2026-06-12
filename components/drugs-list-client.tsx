"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { BrowseListShell } from "@/components/browse-list-shell";
import { Badge } from "@/components/ui/badge";
import type { DrugSummary } from "@/lib/schemas";

interface DrugsListClientProps {
  /** Current page of server-filtered results. */
  items: DrugSummary[];
  /** Total matches for the active query across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** Active server-side `?q=` filter. */
  query: string;
  structureSlugs: string[];
}

export function DrugsListClient({
  items,
  total,
  page,
  pageSize,
  query,
  structureSlugs,
}: DrugsListClientProps) {
  const structureSet = useMemo(
    () => new Set(structureSlugs),
    [structureSlugs],
  );

  return (
    <BrowseListShell
      basePath="/drugs"
      label="drugs"
      filterLabel="Filter drugs"
      placeholder="Filter drugs by name, brand, or ingredient…"
      query={query}
      page={page}
      pageSize={pageSize}
      total={total}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => {
          const hasStructure = structureSet.has(d.slug);
          return (
            <li key={d.slug}>
              <Link
                href={`/drugs/${d.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-card/40 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                {hasStructure && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-y-8 -right-12 w-[115%] text-foreground opacity-20 transition-opacity duration-150 ease-out group-hover:opacity-35 motion-reduce:transition-none dark:opacity-25 dark:group-hover:opacity-40"
                      style={{
                        maskImage: `url(/structures/${d.slug}.svg)`,
                        WebkitMaskImage: `url(/structures/${d.slug}.svg)`,
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "right center",
                        WebkitMaskPosition: "right center",
                        backgroundColor: "currentColor",
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/60 to-transparent transition-colors group-hover:from-accent group-hover:via-accent/60 motion-reduce:transition-none"
                    />
                  </>
                )}
                <div className="relative flex flex-1 flex-col p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 font-semibold">
                        <span className="truncate" translate="no">
                          {d.name}
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
                        {d.slug}
                      </code>
                    </div>
                    {d.classes[0] && (
                      <Badge
                        variant="secondary"
                        className="min-w-0 max-w-[50%] shrink font-mono text-[10px]"
                        title={d.classes[0].name}
                      >
                        <span className="min-w-0 truncate">
                          {d.classes[0].name}
                        </span>
                      </Badge>
                    )}
                  </div>
                  {d.shortDescription && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {d.shortDescription}
                    </p>
                  )}
                  {d.brands.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {d.brands.slice(0, 4).map((b) => (
                        <span
                          key={b}
                          className="rounded-sm border border-border/60 px-1.5 py-0.5"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </BrowseListShell>
  );
}
