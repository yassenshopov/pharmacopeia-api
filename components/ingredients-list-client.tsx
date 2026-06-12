"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrowseListShell } from "@/components/browse-list-shell";
import { Badge } from "@/components/ui/badge";
import type { Ingredient } from "@/lib/schemas";

interface IngredientsListClientProps {
  /** Current page of server-filtered results. */
  items: Ingredient[];
  /** Total matches for the active query across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** Active server-side `?q=` filter. */
  query: string;
}

export function IngredientsListClient({
  items,
  total,
  page,
  pageSize,
  query,
}: IngredientsListClientProps) {
  return (
    <BrowseListShell
      basePath="/ingredients"
      label="ingredients"
      filterLabel="Filter ingredients"
      placeholder="Filter ingredients by name, slug, or synonym…"
      query={query}
      page={page}
      pageSize={pageSize}
      total={total}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.slug}>
            <Link
              href={`/ingredients/${i.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 font-semibold">
                    <span className="truncate" translate="no">
                      {i.name}
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
                    {i.slug}
                  </code>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 font-mono text-[10px]"
                >
                  {i.drugCount} {i.drugCount === 1 ? "drug" : "drugs"}
                </Badge>
              </div>
              {i.molecularFormula && (
                <div
                  className="mt-3 font-mono text-xs text-muted-foreground"
                  translate="no"
                >
                  {i.molecularFormula}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px] text-muted-foreground">
                {i.rxcui && (
                  <span
                    className="rounded border border-border/60 px-1.5 py-0.5"
                    translate="no"
                  >
                    RxCUI {i.rxcui}
                  </span>
                )}
                {i.unii && (
                  <span
                    className="rounded border border-border/60 px-1.5 py-0.5"
                    translate="no"
                  >
                    UNII {i.unii}
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
