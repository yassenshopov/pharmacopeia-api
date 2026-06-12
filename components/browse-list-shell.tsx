"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { PaginationControls } from "@/components/pagination-controls";

const DEBOUNCE_MS = 250;

interface BrowseListShellProps {
  /** Route the list lives on, e.g. `/drugs`. */
  basePath: string;
  /** Plural noun for captions and the empty state, e.g. "drugs". */
  label: string;
  filterLabel: string;
  placeholder: string;
  /** The active server-side query (from the `?q=` search param). */
  query: string;
  page: number;
  pageSize: number;
  /** Total matches for the active query, across all pages. */
  total: number;
  children: ReactNode;
}

/**
 * URL-driven filter + pagination shell shared by every browse page.
 *
 * Filtering and paging both happen server-side (`?q=` and `?page=` are
 * passed to the repository), so the client never needs the whole
 * dataset — the piece that makes browse pages correct at 5,000+ drugs.
 * Typing debounces into `router.replace` so the URL stays shareable;
 * page changes use `router.push` so Back walks page history.
 */
export function BrowseListShell({
  basePath,
  label,
  filterLabel,
  placeholder,
  query,
  page,
  pageSize,
  total,
  children,
}: BrowseListShellProps) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState(query);
  const [isPending, startTransition] = useTransition();

  const href = (q: string, p: number): string => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Debounce typed input into the URL, resetting to page 1.
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === query) return;
    const t = setTimeout(() => {
      startTransition(() => {
        router.replace(href(trimmed, 1), { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Sync external navigation (Back/Forward, shared links) into the
  // input — but never while the user is mid-keystroke in it.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setInput(query);
  }, [query]);

  const goToPage = (p: number) => {
    startTransition(() => {
      router.push(href(query, p));
    });
  };

  const trimmed = input.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          {filterLabel}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
          />
          {trimmed && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                startTransition(() => {
                  router.replace(href("", 1), { scroll: false });
                });
              }}
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
          {query
            ? `${total.toLocaleString()} ${total === 1 ? "match" : "matches"}`
            : ""}
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No {label} match{" "}
          <span className="font-mono text-foreground">
            &ldquo;{query}&rdquo;
          </span>
          .
        </div>
      ) : (
        <div
          data-pending={isPending ? "" : undefined}
          className="transition-opacity data-pending:opacity-60 motion-reduce:transition-none"
        >
          {children}
        </div>
      )}

      {total > 0 && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={goToPage}
          label={label}
        />
      )}
    </div>
  );
}
