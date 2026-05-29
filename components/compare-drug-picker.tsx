"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";

import type { DrugSummary } from "@/lib/schemas";

interface CompareDrugPickerProps {
  /** Every drug summary in the dataset (already paged on the server). */
  all: DrugSummary[];
  /** Drugs currently in the comparison, in display order. */
  selected: { slug: string; name: string }[];
  /** Maximum number of drugs that can be compared at once. */
  maxDrugs: number;
}

/**
 * URL-driven multi-select. Every change rewrites `?drugs=…` so the
 * comparison is shareable, bookmarkable, and statically generatable for
 * any combination — there is no client-side state beyond the query
 * input.
 */
export function CompareDrugPicker({
  all,
  selected,
  maxDrugs,
}: CompareDrugPickerProps) {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedSlugs = useMemo(
    () => new Set(selected.map((s) => s.slug)),
    [selected],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches: DrugSummary[] = [];
    for (const d of all) {
      if (matches.length >= 8) break;
      if (selectedSlugs.has(d.slug)) continue;
      const haystack = [
        d.name,
        d.slug,
        ...d.synonyms,
        ...d.brands,
      ]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) matches.push(d);
    }
    return matches;
  }, [all, query, selectedSlugs]);

  const atLimit = selected.length >= maxDrugs;

  function navigate(slugs: string[]) {
    const href = slugs.length > 0 ? `/compare?drugs=${slugs.join(",")}` : "/compare";
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function add(slug: string) {
    if (atLimit) return;
    if (selectedSlugs.has(slug)) return;
    navigate([...selected.map((s) => s.slug), slug]);
    setQuery("");
  }

  function remove(slug: string) {
    navigate(selected.filter((s) => s.slug !== slug).map((s) => s.slug));
  }

  function clear() {
    navigate([]);
    setQuery("");
  }

  return (
    <div
      data-pending={isPending ? "" : undefined}
      className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {selected.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            Add up to {maxDrugs} drugs to compare.
          </span>
        ) : (
          selected.map((s, idx) => (
            <span
              key={s.slug}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-sm"
            >
              <span
                aria-hidden="true"
                className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 font-mono text-[10px] text-primary"
              >
                {idx + 1}
              </span>
              <span translate="no">{s.name}</span>
              <button
                type="button"
                onClick={() => remove(s.slug)}
                aria-label={`Remove ${s.name}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Add a drug to the comparison
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            atLimit
              ? `Remove a drug to add another (max ${maxDrugs}).`
              : "Add a drug by name, slug, or brand…"
          }
          autoComplete="off"
          spellCheck={false}
          disabled={atLimit}
          className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Drug suggestions"
          className="grid gap-1 sm:grid-cols-2"
        >
          {suggestions.map((d) => (
            <li key={d.slug}>
              <button
                type="button"
                onClick={() => add(d.slug)}
                className="group flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium" translate="no">
                    {d.name}
                  </span>
                  <span
                    className="block truncate font-mono text-[10px] text-muted-foreground"
                    translate="no"
                  >
                    {d.slug}
                  </span>
                </span>
                <Plus
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
