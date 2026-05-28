"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pill, Layers, FlaskConical, Loader2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type SearchKind = "drug" | "class" | "ingredient";

type SearchResult = {
  slug: string;
  name: string;
  kind: SearchKind;
  description?: string;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
};

const OPEN_EVENT = "pharmacopeia:open-search";

const KIND_META: Record<
  SearchKind,
  { label: string; href: (slug: string) => string; icon: typeof Pill }
> = {
  drug: {
    label: "Drugs",
    href: (slug) => `/drugs/${slug}`,
    icon: Pill,
  },
  class: {
    label: "Classes",
    href: (slug) => `/classes/${slug}`,
    icon: Layers,
  },
  ingredient: {
    label: "Ingredients",
    href: (slug) => `/ingredients/${slug}`,
    icon: FlaskConical,
  },
};

const SUGGESTIONS: { name: string; slug: string; kind: SearchKind }[] = [
  { name: "metformin", slug: "metformin", kind: "drug" },
  { name: "sertraline", slug: "sertraline", kind: "drug" },
  { name: "atorvastatin", slug: "atorvastatin", kind: "drug" },
  { name: "ACE inhibitors", slug: "ace-inhibitors", kind: "class" },
  { name: "SSRIs", slug: "ssris", kind: "class" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "/" && !isMod && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }

    function onOpenEvent() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      abortRef.current = null;
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=12`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
        }
      } catch (err) {
        if ((err as { name?: string } | null)?.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  const grouped = useMemo(() => {
    const buckets: Record<SearchKind, SearchResult[]> = {
      drug: [],
      class: [],
      ingredient: [],
    };
    for (const r of results) {
      if (buckets[r.kind]) buckets[r.kind].push(r);
    }
    return buckets;
  }, [results]);

  const handleSelect = useCallback(
    (kind: SearchKind, slug: string) => {
      const href = KIND_META[kind].href(slug);
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const trimmed = query.trim();
  const totalShown = results.length;
  const statusMessage = !trimmed
    ? ""
    : loading
      ? "Searching…"
      : totalShown === 0
        ? "No results"
        : `${totalShown} ${totalShown === 1 ? "result" : "results"}`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search pharmacopeia"
      description="Search drugs, classes, and ingredients"
    >
      <CommandInput
        placeholder="Search drugs, classes, ingredients…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search pharmacopeia"
      />
      <span
        aria-live="polite"
        role="status"
        className="sr-only"
      >
        {statusMessage}
      </span>
      <CommandList>
        {loading && trimmed && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
            Searching…
          </div>
        )}

        {!loading && trimmed && totalShown === 0 && (
          <CommandEmpty>No matches for &ldquo;{trimmed}&rdquo;.</CommandEmpty>
        )}

        {!trimmed && (
          <>
            <CommandEmpty>
              Try{" "}
              <span className="font-mono text-foreground">metformin</span>,{" "}
              <span className="font-mono text-foreground">ACE inhibitor</span>,
              or <span className="font-mono text-foreground">sertraline</span>.
            </CommandEmpty>
            <CommandGroup heading="Suggestions">
              {SUGGESTIONS.map((s) => {
                const Icon = KIND_META[s.kind].icon;
                return (
                  <CommandItem
                    key={`${s.kind}:${s.slug}`}
                    value={`${s.kind}:${s.slug}`}
                    onSelect={() => handleSelect(s.kind, s.slug)}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                      {s.slug}
                    </span>
                    <span className="ml-auto rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.kind}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {trimmed &&
          (Object.keys(grouped) as SearchKind[]).map((kind, index) => {
            const items = grouped[kind];
            if (items.length === 0) return null;
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <div key={kind}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={meta.label}>
                  {items.map((r) => (
                    <CommandItem
                      key={`${r.kind}:${r.slug}`}
                      value={`${r.kind}:${r.slug}:${r.name}`}
                      onSelect={() => handleSelect(r.kind, r.slug)}
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                      <span className="truncate text-foreground">{r.name}</span>
                      <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                        {r.slug}
                      </span>
                      <span className="ml-auto shrink-0 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {kind}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })}
      </CommandList>
    </CommandDialog>
  );
}
