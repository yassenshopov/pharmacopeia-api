import type { ChangelogAction, ChangelogKind } from "@/lib/schemas";

/**
 * Generative thumbnail for a changelog entry. The dataset is
 * reference-only and ships no bitmap art, so each entry gets a
 * deterministic SVG glyph instead: the entry's `kind` picks the shape
 * (a pill for a drug, an aromatic ring for a structure, a database
 * cylinder for a dataset change, …) and its `action` picks the tint.
 * A small id-seeded dot field adds texture so entries of the same kind
 * don't look identical. Purely decorative — hidden from assistive tech.
 */

const ACTION_TINT: Record<ChangelogAction, string> = {
  added: "text-emerald-600 dark:text-emerald-400",
  updated: "text-blue-600 dark:text-blue-400",
  removed: "text-red-600 dark:text-red-400",
  released: "text-primary",
};

const ACTION_WASH: Record<ChangelogAction, string> = {
  added: "from-emerald-500/12",
  updated: "from-blue-500/12",
  removed: "from-red-500/12",
  released: "from-primary/15",
};

/** Tiny deterministic hash so the dot field varies per entry id. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded scatter of faint dots, kept clear of the central glyph. */
function DotField({ seed }: { seed: number }) {
  const dots = Array.from({ length: 5 }, (_, i) => {
    const a = (seed >> (i * 5)) & 0x1f;
    const b = (seed >> (i * 5 + 3)) & 0x1f;
    const x = 4 + (a % 5) * 10;
    const y = 4 + (b % 5) * 10;
    // Skip the central 24±10 box so dots frame, not clutter, the glyph.
    if (x > 12 && x < 36 && y > 12 && y < 36) return null;
    return (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={1}
        fill="currentColor"
        className="text-foreground/15"
      />
    );
  });
  return <>{dots}</>;
}

function Glyph({ kind }: { kind: ChangelogKind }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  switch (kind) {
    case "drug":
      // Capsule split along its long axis, angled.
      return (
        <g transform="rotate(45 24 24)">
          <rect x={17} y={10} width={14} height={28} rx={7} {...common} />
          <line x1={17} y1={24} x2={31} y2={24} {...common} />
          <rect
            x={17}
            y={24}
            width={14}
            height={14}
            rx={7}
            fill="currentColor"
            fillOpacity={0.18}
            stroke="none"
          />
        </g>
      );
    case "structure":
      // Aromatic six-membered ring with an inner circle.
      return (
        <g>
          <polygon
            points="24,8 35,15 35,29 24,36 13,29 13,15"
            {...common}
          />
          <circle cx={24} cy={22} r={6} {...common} />
        </g>
      );
    case "ingredient":
      // Central atom with three bonds to satellite atoms.
      return (
        <g>
          <line x1={24} y1={24} x2={24} y2={11} {...common} />
          <line x1={24} y1={24} x2={13} y2={32} {...common} />
          <line x1={24} y1={24} x2={35} y2={32} {...common} />
          <circle cx={24} cy={24} r={5} fill="currentColor" stroke="none" />
          <circle cx={24} cy={10} r={3} {...common} />
          <circle cx={12} cy={33} r={3} {...common} />
          <circle cx={36} cy={33} r={3} {...common} />
        </g>
      );
    case "interaction":
      // Two nodes joined by an edge.
      return (
        <g>
          <line x1={16} y1={24} x2={32} y2={24} {...common} />
          <circle cx={14} cy={24} r={5} {...common} />
          <circle cx={34} cy={24} r={5} fill="currentColor" stroke="none" />
        </g>
      );
    case "class":
      // Taxonomy: one parent, two children.
      return (
        <g>
          <path d="M24 14 V20 M24 20 H14 V28 M24 20 H34 V28" {...common} />
          <circle cx={24} cy={11} r={3.5} fill="currentColor" stroke="none" />
          <circle cx={14} cy={31} r={3.5} {...common} />
          <circle cx={34} cy={31} r={3.5} {...common} />
        </g>
      );
    case "dataset":
      // Stacked database cylinder.
      return (
        <g>
          <ellipse cx={24} cy={13} rx={12} ry={4} {...common} />
          <path d="M12 13 V35 C12 37 18 39 24 39 C30 39 36 37 36 35 V13" {...common} />
          <path d="M12 24 C12 26 18 28 24 28 C30 28 36 26 36 24" {...common} />
        </g>
      );
    case "endpoint":
      // API angle brackets with a route slash.
      return (
        <g>
          <path d="M19 15 L11 24 L19 33" {...common} />
          <path d="M29 15 L37 24 L29 33" {...common} />
          <line x1={27} y1={13} x2={21} y2={35} {...common} />
        </g>
      );
    default:
      return <circle cx={24} cy={24} r={8} {...common} />;
  }
}

export function ChangelogThumb({
  kind,
  action,
  id,
  className,
}: {
  kind: ChangelogKind;
  action: ChangelogAction;
  id: string;
  className?: string;
}) {
  const seed = seedOf(id);
  return (
    <div
      aria-hidden="true"
      className={`relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br ${ACTION_WASH[action]} to-transparent sm:size-20 ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 48 48"
        className={`size-full ${ACTION_TINT[action]}`}
        role="presentation"
      >
        <DotField seed={seed} />
        <Glyph kind={kind} />
      </svg>
    </div>
  );
}
