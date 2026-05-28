import { ArrowUpRight, Sparkles } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { kindOf, labelFor, type ProvenanceKind } from "@/lib/provenance/kind";
import type { Provenance } from "@/lib/schemas";

type Variant = "inline" | "section" | "minimal";

interface ProvenanceBadgeProps {
  provenance: Provenance;
  variant?: Variant;
  className?: string;
}

/**
 * Unobtrusive UI signal for the trust class of a piece of content.
 *
 * - `ai-extracted` → saffron primary sparkle pill. The point is for the
 *   reader to recognize at a glance that this sentence was touched by
 *   an LLM and should be cross-checked against the linked source.
 * - `auto-sourced` → muted neutral chip. A human wrote the words; a
 *   script just shipped them here.
 * - `curated` → renders nothing. No noise for trusted content.
 *
 * The badge is a Server Component; the tooltip primitive it renders is
 * a client component that handles hover/focus interaction. The trigger
 * is rendered as a focusable `span[role=img]` so it stays inline with
 * surrounding text and accessible by keyboard.
 */
export function ProvenanceBadge({
  provenance,
  variant = "inline",
  className,
}: ProvenanceBadgeProps) {
  const kind = kindOf(provenance);
  if (kind === "curated") return null;

  const label = labelFor(kind, provenance);
  const confidencePct = Math.round(provenance.confidence * 100);
  const extractedAt = formatDate(provenance.extractedAt);

  const isAi = kind === "ai-extracted";
  const ariaLabel = isAi
    ? "AI-extracted content. See provenance for source."
    : `${label}. See provenance for source.`;

  const baseStyles = cn(
    "inline-flex items-center gap-1 rounded-full border align-middle",
    "transition-colors duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2",
    isAi
      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:ring-primary/40"
      : "border-border bg-muted text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:ring-ring/50",
    variant === "minimal" &&
      (isAi
        ? "h-2 w-2 rounded-full border-0 bg-primary p-0"
        : "h-2 w-2 rounded-full border-0 bg-muted-foreground/60 p-0"),
    variant === "inline" && "px-2 py-0.5 text-[10px] font-medium",
    variant === "section" &&
      "px-2.5 py-1 text-[11px] font-medium tracking-wide",
    isAi && variant !== "minimal" && "motion-safe:[&_svg]:animate-pulse",
    className,
  );

  const Icon = isAi ? Sparkles : ArrowUpRight;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            data-variant={variant}
            data-kind={kind}
            className={baseStyles}
          >
            {variant !== "minimal" && (
              <>
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "shrink-0",
                    variant === "section" ? "size-3.5" : "size-3",
                  )}
                />
                <span>{label}</span>
              </>
            )}
          </span>
        }
      />
      <TooltipContent className="max-w-xs">
        <div className="flex flex-col gap-1.5 py-1 text-left text-[11px] leading-snug">
          <div className="font-semibold">{label}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px] opacity-80">
            <dt>extractor</dt>
            <dd className="break-all">{provenance.extractor}</dd>
            <dt>confidence</dt>
            <dd>{confidencePct}%</dd>
            <dt>extracted</dt>
            <dd>{extractedAt}</dd>
          </dl>
          <a
            href={provenance.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-[10px] underline decoration-dotted underline-offset-2 opacity-90 hover:opacity-100"
          >
            {shorten(provenance.sourceUrl, 60)}
          </a>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Static, presentational badge used in the docs legend so we don't
 * need to fabricate a fake Provenance object for documentation.
 */
export function ProvenanceBadgeSample({
  kind,
  label,
  className,
}: {
  kind: Exclude<ProvenanceKind, "curated">;
  label: string;
  className?: string;
}) {
  const isAi = kind === "ai-extracted";
  const Icon = isAi ? Sparkles : ArrowUpRight;
  return (
    <span
      role="img"
      aria-label={`${label} example badge`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        isAi
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function shorten(url: string, max: number): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}
