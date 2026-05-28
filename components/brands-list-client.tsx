"use client";

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { PaginationControls } from "@/components/pagination-controls";
import type { BrandEntry } from "@/lib/data/repository";

const PAGE_SIZE = 30;

interface BrandsListClientProps {
  items: BrandEntry[];
}

function matches(entry: BrandEntry, q: string): boolean {
  if (entry.brand.toLowerCase().includes(q)) return true;
  return entry.drugs.some(
    (d) => d.name.toLowerCase().includes(q) || d.slug.includes(q),
  );
}

export function BrandsListClient({ items }: BrandsListClientProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) => matches(b, q));
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
          Filter brands
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
            placeholder="Find a brand or generic name…"
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
          No brands match{" "}
          <span className="font-mono text-foreground">
            &ldquo;{trimmed}&rdquo;
          </span>
          .
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((b) => (
            <li key={b.brand}>
              <div className="flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-4">
                <div className="font-semibold" translate="no">
                  {b.brand}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  {b.drugs.map((d) => (
                    <Link
                      key={d.slug}
                      href={`/drugs/${d.slug}`}
                      className="group inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                      translate="no"
                    >
                      {d.name}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3 w-3 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none"
                      />
                    </Link>
                  ))}
                </div>
              </div>
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
          label="brands"
        />
      )}
    </div>
  );
}
