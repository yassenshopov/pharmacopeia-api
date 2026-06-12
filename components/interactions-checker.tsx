"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, Check, Loader2, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import type { DrugSummary, Severity } from "@/lib/schemas";

interface CheckPair {
  drugA: string;
  drugB: string;
  severity: Severity;
  description: string;
  recommendation?: string;
  mechanism?: string;
}

interface CheckResponse {
  input: string[];
  pairs: CheckPair[];
  summary: Record<Severity, number>;
}

interface InteractionsCheckerProps {
  /** Initial picker grid — the first page of the dataset. */
  drugs: DrugSummary[];
  narrativeSlugs: string[];
}

const GRID_SIZE = 24;
const FILTER_DEBOUNCE_MS = 250;

const MIN_SELECTION = 2;
const MAX_SELECTION = 20;

const SEVERITY_ORDER: Severity[] = [
  "contraindicated",
  "major",
  "moderate",
  "minor",
  "unknown",
];

const SEVERITY_LABEL: Record<Severity, string> = {
  contraindicated: "Contraindicated",
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
  unknown: "Unknown",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  contraindicated:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  major:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  moderate:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  minor: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  unknown:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function InteractionsChecker({
  drugs,
  narrativeSlugs,
}: InteractionsCheckerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const narrativeSet = useMemo(() => new Set(narrativeSlugs), [narrativeSlugs]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Server-filtered picker grid. The dataset is 5,000+ drugs at scale,
  // so the client never holds more than one grid page; names of drugs
  // the user has seen or selected are accumulated in `drugBySlug`.
  const [filtered, setFiltered] = useState<DrugSummary[]>(
    drugs.slice(0, GRID_SIZE),
  );
  const [filtering, setFiltering] = useState(false);
  const [drugBySlug, setDrugBySlug] = useState<Map<string, DrugSummary>>(
    () => new Map(drugs.map((d) => [d.slug, d])),
  );
  const filterAbortRef = useRef<AbortController | null>(null);
  const firstFilterRun = useRef(true);

  useEffect(() => {
    // The server already rendered the unfiltered first page.
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    const q = query.trim();
    const t = setTimeout(async () => {
      filterAbortRef.current?.abort();
      const controller = new AbortController();
      filterAbortRef.current = controller;
      setFiltering(true);
      try {
        const params = new URLSearchParams({ limit: String(GRID_SIZE) });
        if (q) params.set("q", q);
        const res = await fetch(`/api/v1/drugs?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: DrugSummary[] };
        if (controller.signal.aborted) return;
        setFiltered(data.items);
        setDrugBySlug((prev) => {
          const next = new Map(prev);
          for (const d of data.items) next.set(d.slug, d);
          return next;
        });
      } catch {
        // Aborted or network error — keep the previous grid.
      } finally {
        if (!controller.signal.aborted) setFiltering(false);
      }
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = useCallback((slug: string) => {
    setResult(null);
    setError(null);
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, slug];
    });
  }, []);

  const clear = useCallback(() => {
    setSelected([]);
    setResult(null);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (selected.length < MIN_SELECTION) return;
    setLoading(true);
    setError(null);
    setResult(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/v1/interactions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugs: selected }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setError(`Check failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as CheckResponse;
      if (!controller.signal.aborted) setResult(data);
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [selected]);

  const canSubmit =
    selected.length >= MIN_SELECTION &&
    selected.length <= MAX_SELECTION &&
    !loading;

  const selectionWithNarratives = useMemo(
    () => selected.filter((s) => narrativeSet.has(s)),
    [selected, narrativeSet],
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0 space-y-6">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="picker-title"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Pick {MIN_SELECTION}–{MAX_SELECTION} drugs
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {selected.length}/{MAX_SELECTION} selected
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
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
                placeholder="Filter by name, brand, or ingredient…"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
              />
              {query && (
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
          </div>

          <ul
            aria-labelledby="picker-title"
            aria-busy={filtering}
            className={`mt-4 grid gap-2 transition-opacity sm:grid-cols-2 lg:grid-cols-3 motion-reduce:transition-none ${
              filtering ? "opacity-60" : ""
            }`}
          >
            {filtered.map((d) => {
              const isSelected = selectedSet.has(d.slug);
              const hasNarrative = narrativeSet.has(d.slug);
              const disabled =
                !isSelected && selected.length >= MAX_SELECTION;
              return (
                <li key={d.slug}>
                  <button
                    type="button"
                    onClick={() => toggle(d.slug)}
                    aria-pressed={isSelected}
                    disabled={disabled}
                    className={`group flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/80 bg-card/40 hover:bg-accent/50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      }`}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-medium"
                        translate="no"
                      >
                        {d.name}
                      </span>
                      <span
                        className="block truncate font-mono text-[10px] text-muted-foreground"
                        translate="no"
                      >
                        {d.slug}
                      </span>
                    </span>
                    {hasNarrative && (
                      <BookOpen
                        aria-label="Has interactions narrative"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No drugs match{" "}
                <span className="font-mono text-foreground" translate="no">
                  &ldquo;{query.trim()}&rdquo;
                </span>
                .
              </li>
            )}
          </ul>
        </div>

        {result && (
          <ResultsPanel
            result={result}
            drugBySlug={drugBySlug}
            narrativeSet={narrativeSet}
          />
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-lg border border-border/80 bg-card/40 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Your selection
            </h2>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                Clear
              </button>
            )}
          </div>
          {selected.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Pick at least {MIN_SELECTION} drugs from the list to check.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {selected.map((slug) => {
                const d = drugBySlug.get(slug);
                return (
                  <li key={slug}>
                    <button
                      type="button"
                      onClick={() => toggle(slug)}
                      aria-label={`Remove ${d?.name ?? slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    >
                      <span translate="no">{d?.name ?? slug}</span>
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
                Checking…
              </>
            ) : (
              "Check interactions"
            )}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5" />
              {error}
            </p>
          )}

          {selectionWithNarratives.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              <BookOpen
                aria-hidden="true"
                className="-mt-0.5 mr-1 inline size-3"
              />
              {selectionWithNarratives.length} of {selected.length} carry a
              one-sided narrative.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">How it works.</span>{" "}
          Pick 2–20 drugs and we POST{" "}
          <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
            /api/v1/interactions/check
          </code>{" "}
          with the slugs. The response is severity-graded pairs plus a
          summary count.
        </div>
      </aside>
    </div>
  );
}

function ResultsPanel({
  result,
  drugBySlug,
  narrativeSet,
}: {
  result: CheckResponse;
  drugBySlug: Map<string, DrugSummary>;
  narrativeSet: Set<string>;
}) {
  const pairsBySeverity = useMemo(() => {
    const buckets: Record<Severity, CheckPair[]> = {
      contraindicated: [],
      major: [],
      moderate: [],
      minor: [],
      unknown: [],
    };
    for (const p of result.pairs) buckets[p.severity].push(p);
    return buckets;
  }, [result]);

  const totalPairs = result.pairs.length;
  const narrativeDrugs = result.input.filter((s) => narrativeSet.has(s));

  return (
    <section
      aria-labelledby="results-title"
      className="space-y-6 rounded-lg border border-border/80 bg-card/40 p-6"
    >
      <div>
        <h2
          id="results-title"
          className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Results
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Checked {result.input.length} drug
          {result.input.length === 1 ? "" : "s"} · {totalPairs} pair
          {totalPairs === 1 ? "" : "s"} found
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SEVERITY_ORDER.map((sev) => {
          const count = result.summary[sev] ?? 0;
          return (
            <li
              key={sev}
              className={`rounded-md border px-3 py-2 text-xs ${SEVERITY_STYLE[sev]}`}
            >
              <div className="font-mono text-base font-semibold">{count}</div>
              <div className="text-[10px] uppercase tracking-wider">
                {SEVERITY_LABEL[sev]}
              </div>
            </li>
          );
        })}
      </ul>

      {totalPairs === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">
            No pair-graph interactions in the current dataset.
          </p>
          <p className="mt-2 text-xs">
            The free public pair-graph DDI source (RxNav&apos;s
            <code className="ml-1 mr-1 rounded bg-foreground/5 px-1 py-0.5 font-mono">
              /interaction
            </code>
            API) was retired in 2024. v0 keeps the pair-graph schema in
            place and exposes the openFDA{" "}
            <em>drug interactions</em> narrative per drug instead.
          </p>
          {narrativeDrugs.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                One-sided narratives available
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {narrativeDrugs.map((slug) => {
                  const d = drugBySlug.get(slug);
                  return (
                    <li key={slug}>
                      <Link
                        href={`/drugs/${slug}#interactions`}
                        className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                      >
                        <BookOpen
                          aria-hidden="true"
                          className="size-3 text-muted-foreground"
                        />
                        <span translate="no">{d?.name ?? slug}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {result.pairs.map((p, i) => (
            <li
              key={`${p.drugA}-${p.drugB}-${i}`}
              className="rounded-md border border-border/60 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Link
                    href={`/drugs/${p.drugA}`}
                    translate="no"
                    className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {drugBySlug.get(p.drugA)?.name ?? p.drugA}
                  </Link>
                  <span className="text-muted-foreground">×</span>
                  <Link
                    href={`/drugs/${p.drugB}`}
                    translate="no"
                    className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {drugBySlug.get(p.drugB)?.name ?? p.drugB}
                  </Link>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] uppercase ${SEVERITY_STYLE[p.severity]}`}
                >
                  {p.severity}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {p.description}
              </p>
              {p.recommendation && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Recommendation:{" "}
                  </span>
                  {p.recommendation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
