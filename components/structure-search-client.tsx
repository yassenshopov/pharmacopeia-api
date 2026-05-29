"use client";

import Link from "next/link";
import { AlertTriangle, FlaskConical, Loader2, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import type { StructureMatch } from "@/lib/schemas";

interface StructureSearchClientProps {
  examples: Array<{ slug: string; name: string; smiles: string }>;
  indexedCount: number;
}

interface SearchResponse {
  query: { smiles: string; limit: number; threshold: number };
  method: "tanimoto-2d-fingerprint";
  total: number;
  results: StructureMatch[];
}

type Status = "idle" | "loading" | "success" | "empty" | "error";

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 10;
const DEFAULT_THRESHOLD = 0.4;

export function StructureSearchClient({
  examples,
  indexedCount,
}: StructureSearchClientProps) {
  const smilesId = useId();
  const limitId = useId();
  const thresholdId = useId();

  const [smiles, setSmiles] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const trimmed = smiles.trim();
  const canSubmit = trimmed.length > 0 && status !== "loading";

  const run = useCallback(async () => {
    if (!trimmed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/v1/structure-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: trimmed, limit, threshold }),
        signal: controller.signal,
      });
      const payload = (await res.json()) as
        | SearchResponse
        | { error: { code: string; message: string } };

      if (!res.ok) {
        const message =
          "error" in payload && payload.error?.message
            ? payload.error.message
            : `Request failed (${res.status})`;
        setError(message);
        setStatus("error");
        setData(null);
        return;
      }

      const ok = payload as SearchResponse;
      setData(ok);
      setStatus(ok.results.length === 0 ? "empty" : "success");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, [limit, threshold, trimmed]);

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void run();
    },
    [run],
  );

  const useExample = useCallback(
    (next: string) => {
      setSmiles(next);
      setStatus("idle");
      setError(null);
      setData(null);
    },
    [],
  );

  const heading = useMemo(() => {
    if (status === "success" && data) {
      return `${data.results.length} structural neighbour${
        data.results.length === 1 ? "" : "s"
      }`;
    }
    return null;
  }, [data, status]);

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border/80 bg-card/40 p-5"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={smilesId} className="text-sm font-semibold">
            SMILES
          </label>
          <p className="text-xs text-muted-foreground">
            Paste a SMILES string. We&apos;ll rank every drug in the dataset by
            2D fingerprint (Tanimoto) similarity. {indexedCount} drugs are
            indexed.
          </p>
          <textarea
            id={smilesId}
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            rows={2}
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. CC(=O)NC1=CC=C(C=C1)O"
            translate="no"
            className="min-h-[3rem] resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_max-content]">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={limitId}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Top N
            </label>
            <input
              id={limitId}
              type="number"
              min={1}
              max={MAX_LIMIT}
              step={1}
              value={limit}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(next)) {
                  setLimit(Math.min(Math.max(next, 1), MAX_LIMIT));
                }
              }}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={thresholdId}
              className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              <span>Min similarity</span>
              <span className="font-mono tabular-nums text-foreground">
                {threshold.toFixed(2)}
              </span>
            </label>
            <input
              id={thresholdId}
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(e) =>
                setThreshold(Number.parseFloat(e.target.value) || 0)
              }
              className="h-10 accent-primary"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Search
              </>
            )}
          </button>
        </div>
      </form>

      <div>
        <div className="mb-3 text-xs text-muted-foreground">
          Or try an example:
        </div>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.slug}
              type="button"
              onClick={() => useExample(ex.smiles)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              translate="no"
            >
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {status === "error" && error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-semibold">Couldn&apos;t parse that SMILES</div>
            <div className="mt-1 font-mono text-xs opacity-80">{error}</div>
          </div>
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No drugs in the dataset are above{" "}
          <span className="font-mono text-foreground">
            {threshold.toFixed(2)}
          </span>{" "}
          Tanimoto similarity to your query.
          {threshold > 0 && (
            <>
              {" "}
              Try lowering the threshold or running with the slider at 0.
            </>
          )}
        </div>
      )}

      {status === "success" && data && (
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {heading}
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              Tanimoto · 512-bit OCL fingerprint
            </span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {data.results.map((r, idx) => (
              <li key={r.slug}>
                <Link
                  href={`/drugs/${r.slug}`}
                  className="group flex items-stretch gap-3 rounded-md border border-border/60 px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <span className="grid w-8 shrink-0 place-items-center font-mono text-xs text-muted-foreground tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium"
                      translate="no"
                    >
                      {r.name}
                    </span>
                    {r.className && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.className}
                      </span>
                    )}
                    <span
                      className="block truncate font-mono text-[10px] text-muted-foreground/80"
                      translate="no"
                    >
                      {r.smiles}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className="self-center font-mono text-[11px] tabular-nums"
                    title={`Tanimoto similarity ${r.score.toFixed(3)}`}
                  >
                    {(r.score * 100).toFixed(0)}%
                  </Badge>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-md border border-border/40 bg-card/30 p-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          Structural proximity only.
        </span>{" "}
        Similarity over 2D fingerprints flags molecules that look alike on
        paper — it is never a claim of therapeutic equivalence,
        bioequivalence, or shared safety profile. Two molecules can score
        99% similar and behave very differently in patients.
      </div>
    </div>
  );
}
