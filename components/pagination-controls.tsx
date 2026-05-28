"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

/**
 * Client-side pagination control used by browse list pages. Renders
 * Prev / page numbers / Next with a "showing X–Y of N" caption.
 *
 * Filtering operates on the full client dataset, so when the user
 * types a query we collapse to a single page. When the underlying
 * dataset moves to server pagination (Stage 1 Supabase), this
 * component is replaced by a Link-based variant that updates
 * `searchParams`.
 */
export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  label = "results",
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return (
      <p
        aria-live="polite"
        role="status"
        className="font-mono text-xs text-muted-foreground"
      >
        {total} {label}
      </p>
    );
  }

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pages = pageWindow(safePage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p
        aria-live="polite"
        role="status"
        className="font-mono text-xs text-muted-foreground"
      >
        {start.toLocaleString()}–{end.toLocaleString()} of{" "}
        {total.toLocaleString()} {label}
      </p>

      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" />
            Prev
          </button>
        </li>
        {pages.map((p, i) =>
          p === "…" ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className="px-1 text-xs text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === safePage ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                  p === safePage
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </button>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Compact page-number window: always show first and last, the current
 * page and one neighbor on each side, and "…" gaps for the rest.
 *
 *   1 … 4 5 6 … 23
 */
function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "…"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push("…");
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 1) out.push("…");
  out.push(total);
  return out;
}
