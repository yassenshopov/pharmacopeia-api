import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type {
  ChemicalStructure,
  Drug,
  Interaction,
  Severity,
} from "@/lib/schemas";

/**
 * Side-by-side drug comparison rendering, shared by the interactive
 * `/compare?drugs=` picker view and the static, indexable
 * `/compare/{a}-vs-{b}` pages. Both surfaces must render an identical
 * contrast, so the grid, cells, and pairwise-interaction panel live here
 * once rather than being copied per route.
 *
 * Strictly a reference contrast, never a recommendation: no cell ever
 * renders "better than" / "preferred over" language.
 */

export interface ComparisonColumn {
  slug: string;
  drug: Drug;
  structure: ChemicalStructure | null;
  structureSvg: string | null;
}

const COMPARISON_ROWS = [
  "identity",
  "class",
  "mechanism",
  "targets",
  "indications",
  "structure",
  "identifiers",
] as const;

type RowId = (typeof COMPARISON_ROWS)[number];

const ROW_LABELS: Record<RowId, string> = {
  identity: "At a glance",
  class: "Class",
  mechanism: "Mechanism",
  targets: "Molecular targets",
  indications: "Indications",
  structure: "Structure",
  identifiers: "Identifiers",
};

export function comparisonColumnsClass(columnCount: number): string {
  return columnCount === 1
    ? "md:grid-cols-2"
    : columnCount === 2
      ? "md:grid-cols-3"
      : "md:grid-cols-4";
}

export function ComparisonGrid({
  columns,
  columnsClass,
}: {
  columns: ComparisonColumn[];
  columnsClass: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/40">
      <div className="min-w-[640px]">
        {COMPARISON_ROWS.map((row, idx) => (
          <div
            key={row}
            className={`grid ${columnsClass} grid-cols-2 gap-x-6 gap-y-4 border-b border-border/60 px-4 py-5 last:border-b-0 sm:px-6 ${
              idx === 0 ? "bg-accent/30" : ""
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {ROW_LABELS[row]}
            </div>
            {columns.map((col) => (
              <div key={`${row}-${col.slug}`} className="min-w-0">
                <CellContent row={row} column={col} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CellContent({
  row,
  column,
}: {
  row: RowId;
  column: ComparisonColumn;
}) {
  const { drug, structure, structureSvg } = column;
  switch (row) {
    case "identity":
      return <IdentityCell drug={drug} />;
    case "class":
      return <ClassCell drug={drug} />;
    case "mechanism":
      return drug.mechanism ? (
        <p className="text-sm leading-relaxed text-foreground/90">
          {drug.mechanism.summary}
        </p>
      ) : (
        <Dash />
      );
    case "targets":
      return drug.mechanism?.targets.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {drug.mechanism.targets.map((t) => (
            <li key={t}>
              <Badge variant="outline" className="font-mono text-[10px]">
                {t}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <Dash />
      );
    case "indications":
      return drug.indications.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {drug.indications.slice(0, 6).map((ind, i) => (
            <li
              key={`${ind.text}-${i}`}
              className="flex items-baseline justify-between gap-2 text-foreground/90"
            >
              <span>{ind.text}</span>
              {ind.icd10.length > 0 && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {ind.icd10.join(", ")}
                </span>
              )}
            </li>
          ))}
          {drug.indications.length > 6 && (
            <li className="text-xs text-muted-foreground">
              +{drug.indications.length - 6} more
            </li>
          )}
        </ul>
      ) : (
        <Dash />
      );
    case "structure":
      return (
        <StructureCell
          drug={drug}
          structure={structure}
          structureSvg={structureSvg}
        />
      );
    case "identifiers":
      return <IdentifiersCell drug={drug} />;
  }
}

function IdentityCell({ drug }: { drug: Drug }) {
  return (
    <div className="space-y-2">
      <Link
        href={`/drugs/${drug.slug}`}
        translate="no"
        className="block rounded-sm text-lg font-semibold leading-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {drug.name}
      </Link>
      <code
        className="block break-all font-mono text-[11px] text-muted-foreground"
        translate="no"
      >
        {drug.slug}
      </code>
      {drug.shortDescription && (
        <p className="text-xs text-muted-foreground">
          {drug.shortDescription}
        </p>
      )}
      {drug.brands.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {drug.brands.slice(0, 4).map((b) => (
            <span
              key={b}
              className="rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCell({ drug }: { drug: Drug }) {
  if (drug.classes.length === 0) return <Dash />;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {drug.classes.map((c) => (
        <li key={`${c.kind}-${c.slug}`}>
          <Link
            href={`/classes/${c.slug}`}
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Badge variant="secondary" className="hover:bg-accent">
              <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {c.kind}
              </span>
              {c.name}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StructureCell({
  drug,
  structure,
  structureSvg,
}: {
  drug: Drug;
  structure: ChemicalStructure | null;
  structureSvg: string | null;
}) {
  if (!structure) return <Dash />;
  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={`2D chemical structure of ${drug.name}`}
        className="block h-auto w-full max-w-[220px] text-foreground/85 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      >
        {structureSvg ? (
          <div
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: structureSvg }}
          />
        ) : (
          <img
            src={structure.structureSvgPath}
            alt=""
            width={220}
            height={170}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        )}
      </div>
      {structure.iupacName && (
        <p className="text-xs italic text-foreground/80">
          {structure.iupacName}
        </p>
      )}
      <p
        className="break-all font-mono text-[10px] text-muted-foreground"
        translate="no"
      >
        {structure.smiles}
      </p>
    </div>
  );
}

function IdentifiersCell({ drug }: { drug: Drug }) {
  const rows: { label: string; value: string }[] = [];
  if (drug.identifiers.rxcui)
    rows.push({ label: "RxCUI", value: drug.identifiers.rxcui });
  if (drug.identifiers.atc.length > 0)
    rows.push({ label: "ATC", value: drug.identifiers.atc.join(", ") });
  if (drug.identifiers.unii)
    rows.push({ label: "UNII", value: drug.identifiers.unii });
  if (drug.identifiers.drugbank)
    rows.push({ label: "DrugBank", value: drug.identifiers.drugbank });
  if (drug.identifiers.chembl)
    rows.push({ label: "ChEMBL", value: drug.identifiers.chembl });
  if (drug.identifiers.pubchem)
    rows.push({ label: "PubChem", value: drug.identifiers.pubchem });
  if (rows.length === 0) return <Dash />;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {r.label}
          </dt>
          <dd className="min-w-0 break-words font-mono">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Dash() {
  return (
    <span aria-label="No data" className="text-sm text-muted-foreground/50">
      —
    </span>
  );
}

const SEVERITY_COLOR: Record<Severity, string> = {
  contraindicated:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  major:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  moderate:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  minor: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function PairInteractions({
  interactions,
}: {
  interactions: Interaction[];
}) {
  return (
    <section
      aria-labelledby="pair-interactions-title"
      className="rounded-lg border border-border/80 bg-card/40 p-5"
    >
      <h2
        id="pair-interactions-title"
        className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Known pairwise interactions between selected drugs
      </h2>
      <ul className="mt-3 space-y-2">
        {interactions.map((x, i) => (
          <li
            key={`${x.drugA}-${x.drugB}-${i}`}
            className="rounded-md border border-border/60 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs" translate="no">
                {x.drugA} ↔ {x.drugB}
              </span>
              <span
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${SEVERITY_COLOR[x.severity]}`}
              >
                {x.severity}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {x.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
