"use client";

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/ui/badge";
import type { Ingredient } from "@/lib/schemas";

const PAGE_SIZE = 24;

interface IngredientsListClientProps {
  items: Ingredient[];
}

function matches(ing: Ingredient, q: string): boolean {
  const haystack = [
    ing.name,
    ing.slug,
    ...ing.synonyms,
    ing.molecularFormula ?? "",
    ing.rxcui ?? "",
    ing.unii ?? "",
    ing.inchikey ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function IngredientsListClient({ items }: IngredientsListClientProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => matches(i, q));
  }, [items, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const trimmed = query.trim();
  const showCount = trimmed.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Filter ingredients
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter ingredients by name, formula, or identifier…"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
          />
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>
        <p
          aria-live="polite"
          role="status"
          className="min-h-[1.25rem] text-xs text-muted-foreground"
        >
          {showCount
            ? `${filtered.length} of ${items.length} ${items.length === 1 ? "match" : "matches"}`
            : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No ingredients match{" "}
          <span className="font-mono text-foreground">
            &ldquo;{trimmed}&rdquo;
          </span>
          .
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((i) => (
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
      )}

      {filtered.length > 0 && (
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          label="ingredients"
        />
      )}
    </div>
  );
}
