"use client";

import * as d3 from "d3";
import Link from "next/link";
import { ExternalLink, RotateCcw, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MechanismGraph,
  MechanismGraphNode,
  MechanismNodeType,
} from "@/lib/data/repository";

interface MoaGraphClientProps {
  graph: MechanismGraph;
}

type SimNode = MechanismGraphNode & d3.SimulationNodeDatum;
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  kind: "member" | "target";
}

const TYPE_META: Record<
  MechanismNodeType,
  { label: string; plural: string; color: string }
> = {
  drug: { label: "Drug", plural: "Drugs", color: "var(--chart-1)" },
  moa: { label: "MoA class", plural: "MoA classes", color: "var(--chart-2)" },
  target: { label: "Target", plural: "Targets", color: "var(--chart-3)" },
};

const TYPE_ORDER: MechanismNodeType[] = ["drug", "moa", "target"];

function nodeRadius(degree: number): number {
  return Math.max(4.5, Math.min(22, 4.5 + Math.sqrt(degree) * 2.4));
}

// Only hub nodes (this many connections or more) are labelled at rest, so a
// large network stays legible; the rest reveal their labels on hover/focus.
const LABEL_DEGREE = 6;

export function MoaGraphClient({ graph }: MoaGraphClientProps) {
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dims, setDims] = useState({ width: 0, height: 600 });
  const [visible, setVisible] = useState<Record<MechanismNodeType, boolean>>({
    drug: true,
    moa: true,
    target: true,
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MechanismGraphNode | null>(null);

  const typeCounts = useMemo(() => {
    const c: Record<MechanismNodeType, number> = { drug: 0, moa: 0, target: 0 };
    for (const n of graph.nodes) c[n.type] += 1;
    return c;
  }, [graph]);

  // Adjacency over the full (unfiltered) graph — used for neighbour
  // highlighting and the detail panel.
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of graph.nodes) map.set(n.id, new Set());
    for (const l of graph.links) {
      const s = l.source as string;
      const t = l.target as string;
      map.get(s)?.add(t);
      map.get(t)?.add(s);
    }
    return map;
  }, [graph]);

  const nodesById = useMemo(() => {
    const m = new Map<string, MechanismGraphNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  // Refs the highlight pass reads without retriggering the layout effect.
  const emphasisFnRef = useRef<((active: Set<string> | null) => void) | null>(
    null,
  );
  const queryRef = useRef(query);
  const selectedRef = useRef<MechanismGraphNode | null>(selected);
  queryRef.current = query;
  selectedRef.current = selected;

  // Compute which node ids should be emphasised given current selection/query.
  const computeActive = useCallback((): Set<string> | null => {
    const sel = selectedRef.current;
    if (sel) {
      const set = new Set<string>([sel.id]);
      for (const n of adjacency.get(sel.id) ?? []) set.add(n);
      return set;
    }
    const q = queryRef.current.trim().toLowerCase();
    if (q) {
      const set = new Set<string>();
      for (const n of graph.nodes) {
        if (n.label.toLowerCase().includes(q)) {
          set.add(n.id);
          for (const nb of adjacency.get(n.id) ?? []) set.add(nb);
        }
      }
      return set;
    }
    return null;
  }, [adjacency, graph]);

  // Responsive sizing.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const h = w < 640 ? 460 : 620;
      setDims({ width: Math.round(w), height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build / rebuild the simulation. Re-runs when the data, visible types,
  // or dimensions change — but NOT when only selection/query change.
  useEffect(() => {
    if (!svgRef.current || dims.width === 0) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { width, height } = dims;

    // d3 mutates link endpoints from ids into node objects after the first
    // tick; this resolves either form back to the node id.
    const endId = (e: string | number | SimNode): string =>
      typeof e === "object" ? e.id : String(e);
    const endXY = (e: string | number | SimNode): [number, number] =>
      typeof e === "object" ? [e.x ?? 0, e.y ?? 0] : [0, 0];

    const nodes: SimNode[] = graph.nodes
      .filter((n) => visible[n.type])
      .map((n) => ({ ...n }));
    const present = new Set(nodes.map((n) => n.id));
    const links: SimLink[] = graph.links
      .filter((l) => {
        const s = typeof l.source === "string" ? l.source : "";
        const t = typeof l.target === "string" ? l.target : "";
        return present.has(s) && present.has(t);
      })
      .map((l) => ({ ...l }));

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    const root = svg.append("g");

    // Zoom + pan on the root group.
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    const linkSel = root
      .append("g")
      .attr("fill", "none")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-width", (d) => (d.kind === "member" ? 1.1 : 0.8))
      .attr("stroke-opacity", 0.22)
      .attr("stroke-dasharray", (d) => (d.kind === "target" ? "3 3" : null));

    const nodeSel = root
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${TYPE_META[d.type].label}: ${d.label}`);

    nodeSel
      .append("circle")
      .attr("r", (d) => nodeRadius(d.degree))
      .style("fill", (d) => TYPE_META[d.type].color)
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 1.5);

    const labelSel = nodeSel
      .append("text")
      .text((d) => d.label)
      .attr("x", (d) => nodeRadius(d.degree) + 4)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("paint-order", "stroke")
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 3)
      .style("fill", "var(--foreground)")
      .style("pointer-events", "none")
      // Only hub labels are shown at rest to keep the canvas readable.
      .style("display", (d) => (d.degree >= LABEL_DEGREE ? null : "none"));

    // Highlight helper, captured into a ref for the selection/query effect.
    const applyEmphasis = (active: Set<string> | null) => {
      if (!active) {
        nodeSel.style("opacity", 1);
        labelSel.style("display", (d) =>
          d.degree >= LABEL_DEGREE ? null : "none",
        );
        linkSel.attr("stroke-opacity", 0.22).attr("stroke", "var(--muted-foreground)");
        return;
      }
      nodeSel.style("opacity", (d) => (active.has(d.id) ? 1 : 0.12));
      labelSel.style("display", (d) => (active.has(d.id) ? null : "none"));
      linkSel
        .attr("stroke", (d) =>
          active.has(endId(d.source)) && active.has(endId(d.target))
            ? "var(--primary)"
            : "var(--muted-foreground)",
        )
        .attr("stroke-opacity", (d) =>
          active.has(endId(d.source)) && active.has(endId(d.target))
            ? 0.85
            : 0.05,
        );
    };
    emphasisFnRef.current = applyEmphasis;

    const neighborsOf = (id: string): Set<string> => {
      const set = new Set<string>([id]);
      for (const l of links) {
        const s = endId(l.source);
        const t = endId(l.target);
        if (s === id) set.add(t);
        if (t === id) set.add(s);
      }
      return set;
    };

    // Local recompute mirroring computeActive but bound to this build's data.
    const computeActiveLocal = (): Set<string> | null => {
      const q = queryRef.current.trim().toLowerCase();
      if (!q) return null;
      const set = new Set<string>();
      for (const n of nodes) {
        if (n.label.toLowerCase().includes(q)) {
          for (const id of neighborsOf(n.id)) set.add(id);
        }
      }
      return set;
    };

    nodeSel
      .on("mouseenter", (_event, d) => {
        if (selectedRef.current) return;
        applyEmphasis(neighborsOf(d.id));
      })
      .on("mouseleave", () => {
        if (selectedRef.current) return;
        applyEmphasis(queryRef.current.trim() ? computeActiveLocal() : null);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelected((prev) => (prev?.id === d.id ? null : d));
      })
      .on("keydown", (event, d) => {
        const ke = event as KeyboardEvent;
        if (ke.key === "Enter" || ke.key === " ") {
          ke.preventDefault();
          setSelected((prev) => (prev?.id === d.id ? null : d));
        }
      });

    svg.on("click", () => setSelected(null));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "member" ? 55 : 42))
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-160))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 4),
      )
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04));

    const ticked = () => {
      linkSel
        .attr("x1", (d) => endXY(d.source)[0])
        .attr("y1", (d) => endXY(d.source)[1])
        .attr("x2", (d) => endXY(d.target)[0])
        .attr("y2", (d) => endXY(d.target)[1]);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    };

    if (prefersReduced) {
      // Skip the animated settle: tick to a stable layout, then paint once.
      simulation.stop();
      simulation.tick(220);
      ticked();
    } else {
      simulation.on("tick", ticked);
    }

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag);

    // Apply any standing emphasis from a pre-existing selection/query.
    applyEmphasis(
      selectedRef.current
        ? neighborsOf(selectedRef.current.id)
        : computeActiveLocal(),
    );

    return () => {
      simulation.stop();
      emphasisFnRef.current = null;
    };
  }, [graph, visible, dims]);

  // Re-apply emphasis when selection or query changes, without rebuilding.
  useEffect(() => {
    emphasisFnRef.current?.(computeActive());
  }, [selected, query, computeActive]);

  const resetView = useCallback(() => {
    setSelected(null);
    setQuery("");
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(400)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  const selectedNeighbors = useMemo(() => {
    if (!selected) return [];
    return [...(adjacency.get(selected.id) ?? [])]
      .map((id) => nodesById.get(id))
      .filter((n): n is MechanismGraphNode => Boolean(n))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selected, adjacency, nodesById]);

  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_ORDER.map((t) => {
            const on = visible[t];
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setVisible((prev) => ({ ...prev, [t]: !prev[t] }))
                }
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                  on
                    ? "border-border bg-card/60 text-foreground"
                    : "border-border/60 bg-transparent text-muted-foreground line-through"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_META[t].color }}
                />
                {TYPE_META[t].plural}
                <span className="font-mono text-xs text-muted-foreground">
                  {typeCounts[t]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <label htmlFor={searchId} className="sr-only">
              Highlight nodes
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Highlight a drug, class, target…"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none"
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear highlight"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-card/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border border-border/70 bg-card/20"
        >
          <svg
            ref={svgRef}
            role="img"
            aria-label="Mechanism-of-action network graph. Drag nodes to rearrange, scroll to zoom, click a node for details."
            className="block h-full w-full touch-none"
          />
          <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-muted-foreground">
            Drag to rearrange · scroll to zoom · click a node for details
          </p>
        </div>

        <aside className="rounded-xl border border-border/70 bg-card/30 p-4">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  translate="no"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: TYPE_META[selected.type].color }}
                  />
                  {TYPE_META[selected.type].label}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close details"
                  className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </div>
              <h2 className="text-base font-semibold leading-tight" translate="no">
                {selected.label}
              </h2>
              {selected.slug && selected.type !== "target" && (
                <Link
                  href={
                    selected.type === "drug"
                      ? `/drugs/${selected.slug}`
                      : `/classes/${selected.slug}`
                  }
                  className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border/80 bg-card/40 px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  {selected.type === "drug" ? "Drug page" : "Class page"}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </Link>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Connected ({selectedNeighbors.length})
                </p>
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                  {selectedNeighbors.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(n)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: TYPE_META[n.type].color }}
                        />
                        <span className="truncate" translate="no">
                          {n.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to read this</p>
              <p>
                Each <span className="text-foreground">drug</span> is linked to
                the mechanism-of-action classes it belongs to and the molecular
                targets it acts on. Drugs that share a mechanism or target pull
                together into clusters.
              </p>
              <ul className="flex flex-col gap-1.5">
                {TYPE_ORDER.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_META[t].color }}
                    />
                    <span>
                      <span className="text-foreground">
                        {TYPE_META[t].plural}
                      </span>{" "}
                      · {typeCounts[t]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Select a node to focus its neighbourhood. Educational structural
                view only — not a clinical reference.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
