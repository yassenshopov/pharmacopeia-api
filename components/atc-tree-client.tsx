"use client";

import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pill,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { AtcTreeNode } from "@/lib/data/repository";

interface AtcTreeClientProps {
  tree: AtcTreeNode[];
}

const LEVEL_LABEL: Record<number, string> = {
  1: "Anatomical main group",
  2: "Therapeutic subgroup",
  3: "Pharmacological subgroup",
  4: "Chemical subgroup",
  5: "Substance",
};

// Indentation per level (level 1 has no indent). Kept modest so deep
// branches stay readable on narrow viewports.
const INDENT_REM = 1.15;

function collectCodes(
  nodes: AtcTreeNode[],
  pred: (n: AtcTreeNode) => boolean,
  acc: Set<string>,
): Set<string> {
  for (const n of nodes) {
    if (pred(n)) acc.add(n.code);
    if (n.children.length) collectCodes(n.children, pred, acc);
  }
  return acc;
}

interface FilterResult {
  nodes: AtcTreeNode[];
  open: Set<string>;
  matchCount: number;
}

/** Prune the tree to branches that match `q`, collecting ancestor codes to
 *  auto-expand. A node is kept if it matches or any descendant matches. */
function filterTree(nodes: AtcTreeNode[], q: string): FilterResult {
  const open = new Set<string>();
  let matchCount = 0;

  const walk = (list: AtcTreeNode[]): AtcTreeNode[] => {
    const out: AtcTreeNode[] = [];
    for (const n of list) {
      const selfMatch =
        n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q);
      const keptChildren = n.children.length ? walk(n.children) : [];
      if (selfMatch || keptChildren.length) {
        if (selfMatch) matchCount += 1;
        if (keptChildren.length) open.add(n.code);
        out.push({ ...n, children: keptChildren });
      }
    }
    return out;
  };

  return { nodes: walk(nodes), open, matchCount };
}

export function AtcTreeClient({ tree }: AtcTreeClientProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    // Open the level-1 anatomical groups by default; deeper levels start closed.
    () => new Set(tree.map((n) => n.code)),
  );

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  const { nodes, open, matchCount } = useMemo<FilterResult>(() => {
    if (!q) return { nodes: tree, open: new Set<string>(), matchCount: 0 };
    return filterTree(tree, q);
  }, [tree, q]);

  const toggle = useCallback((code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(
      collectCodes(tree, (n) => n.children.length > 0, new Set<string>()),
    );
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // While filtering, matching branches are force-open regardless of the
  // user's manual expand state.
  const isOpen = useCallback(
    (code: string) => (q ? open.has(code) : expanded.has(code)),
    [q, open, expanded],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={inputId} className="sr-only">
            Filter the ATC tree
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
            placeholder="Filter by code or name…"
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <Maximize2 aria-hidden="true" className="size-3.5" /> Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <Minimize2 aria-hidden="true" className="size-3.5" /> Collapse all
          </button>
        </div>
      </div>

      <p
        aria-live="polite"
        role="status"
        className="min-h-[1.25rem] text-xs text-muted-foreground"
      >
        {q
          ? `${matchCount} ${matchCount === 1 ? "match" : "matches"} for “${trimmed}”`
          : ""}
      </p>

      {nodes.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          Nothing in the ATC tree matches{" "}
          <span className="font-mono text-foreground">“{trimmed}”</span>.
        </div>
      ) : (
        <ul className="rounded-lg border border-border/70 bg-card/30 p-1.5">
          {nodes.map((node) => (
            <TreeRow
              key={node.code}
              node={node}
              depth={0}
              isOpen={isOpen}
              toggle={toggle}
              query={q}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TreeRowProps {
  node: AtcTreeNode;
  depth: number;
  isOpen: (code: string) => boolean;
  toggle: (code: string) => void;
  query: string;
}

function TreeRow({ node, depth, isOpen, toggle, query }: TreeRowProps) {
  const hasChildren = node.children.length > 0;
  const open = hasChildren && isOpen(node.code);
  const indent = depth * INDENT_REM;

  const matches =
    query &&
    (node.name.toLowerCase().includes(query) ||
      node.code.toLowerCase().includes(query));

  const href =
    node.level === 5
      ? `/drugs/${node.slug}`
      : node.level === 4
        ? `/classes/${node.slug}`
        : undefined;

  const codeBadge = (
    <Badge
      variant="outline"
      className="shrink-0 font-mono text-[10px] tabular-nums"
      translate="no"
    >
      {node.code}
    </Badge>
  );

  const label = (
    <span className="flex min-w-0 items-center gap-2">
      {node.level === 5 && (
        <Pill aria-hidden="true" className="size-3.5 shrink-0 text-chart-3" />
      )}
      <span
        className={`truncate text-sm ${
          node.level <= 2 ? "font-semibold" : "font-medium"
        } ${matches ? "text-primary" : ""}`}
        title={node.name}
      >
        {node.name}
      </span>
    </span>
  );

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md pr-2 transition-colors hover:bg-accent/40 motion-reduce:transition-none"
        style={{ paddingLeft: `${indent}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.code)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-4 transition-transform duration-150 ease-out motion-reduce:transition-none ${
                open ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="size-7 shrink-0" />
        )}

        <LevelDot level={node.level} />

        {href ? (
          <Link
            href={href}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {label}
            <span className="flex shrink-0 items-center gap-2">
              {node.level === 4 && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {node.drugCount}{" "}
                  {node.drugCount === 1 ? "substance" : "substances"}
                </span>
              )}
              {codeBadge}
              <ExternalLink
                aria-hidden="true"
                className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
              />
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => toggle(node.code)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {label}
            <span className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {node.drugCount}
              </span>
              {codeBadge}
            </span>
          </button>
        )}
      </div>

      {open && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.code}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              toggle={toggle}
              query={query}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const LEVEL_DOT_CLASS: Record<number, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-4",
  4: "bg-chart-5",
  5: "bg-chart-3",
};

function LevelDot({ level }: { level: number }) {
  return (
    <span
      aria-hidden="true"
      title={LEVEL_LABEL[level]}
      className={`size-2 shrink-0 rounded-full ${LEVEL_DOT_CLASS[level] ?? "bg-muted-foreground"}`}
    />
  );
}
