"use client";

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { DrugSummary } from "@/lib/schemas";

interface DrugsListClientProps {
  items: DrugSummary[];
}

function matches(drug: DrugSummary, q: string): boolean {
  const haystack = [
    drug.name,
    drug.slug,
    ...drug.synonyms,
    ...drug.brands,
    ...drug.ingredients.map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function DrugsListClient({ items }: DrugsListClientProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) => matches(d, q));
  }, [items, query]);

  const trimmed = query.trim();
  const showCount = trimmed.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Filter drugs
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
            placeholder="Filter drugs by name, brand, or ingredient…"
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
          No drugs match{" "}
          <span className="font-mono text-foreground">
            &ldquo;{trimmed}&rdquo;
          </span>
          .
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/drugs/${d.slug}`}
                className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
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
                      className="font-mono text-[10px]"
                    >
                      {d.classes[0].name}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
