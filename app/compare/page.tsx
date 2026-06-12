import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CompareDrugPicker } from "@/components/compare-drug-picker";
import { Badge } from "@/components/ui/badge";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { getRepository } from "@/lib/data/repository";
import type {
  ChemicalStructure,
  Drug,
  Interaction,
  Severity,
} from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * Side-by-side drug comparison view.
 *
 * Reads 2–3 drug slugs from `?drugs=a,b,c` and renders them as columns
 * across the canonical reference axes — identity, classes, mechanism,
 * indications, identifiers, structure. Strictly a reference contrast,
 * never a recommendation: the page intentionally avoids language like
 * "better than" or "preferred over".
 */

// The page is driven by `?drugs=…` query params, so it must render
// dynamically. `force-static` would force `searchParams` to be empty,
// breaking the picker (URL changes but the comparison never updates)
// and producing "Router action dispatched before initialization" when
// the client picker calls `router.replace`.
export const dynamic = "force-dynamic";

const MAX_DRUGS = 3;
const COMPARE_PATH = "/compare";

interface PageProps {
  searchParams: Promise<{ drugs?: string | string[] }>;
}

function parseSlugs(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const flat = Array.isArray(raw) ? raw.join(",") : raw;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of flat.split(/[,\s]+/)) {
    const slug = part.trim().toLowerCase();
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_DRUGS) break;
  }
  return out;
}

const loadStructureSvg = cache(
  async (svgPath: string): Promise<string | null> => {
    if (!svgPath.startsWith("/structures/") || svgPath.includes("..")) {
      return null;
    }
    try {
      const filePath = path.join(
        process.cwd(),
        "public",
        svgPath.replace(/^\//, ""),
      );
      return await readFile(filePath, "utf8");
    } catch {
      return null;
    }
  },
);

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const slugs = parseSlugs((await searchParams).drugs);
  const repo = getRepository();
  const drugs = (
    await Promise.all(slugs.map((s) => repo.getDrug(s)))
  ).filter((d): d is Drug => d !== null);

  const baseTitle = "Side-by-side drug comparison";
  const title = drugs.length > 0
    ? `Compare ${drugs.map((d) => d.name).join(" vs ")}`
    : baseTitle;
  const description =
    drugs.length > 0
      ? `Class, mechanism, indications, identifiers, and 2D structure for ${drugs
          .map((d) => d.name)
          .join(", ")} — side by side.`
      : "Put two or three drugs next to each other and contrast their class, mechanism, indications, identifiers, and chemistry.";

  const url = absoluteUrl(
    drugs.length > 0
      ? `${COMPARE_PATH}?drugs=${drugs.map((d) => d.slug).join(",")}`
      : COMPARE_PATH,
  );
  const ogImage = ogImageUrl({
    title: drugs.length > 0 ? title : baseTitle,
    subtitle:
      drugs.length > 0
        ? drugs.map((d) => d.slug).join(" · ")
        : "Reference contrast",
  });

  return {
    title: drugs.length > 0 ? title : baseTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: drugs.length > 0 ? title : baseTitle,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: drugs.length > 0 ? title : baseTitle,
      description,
      images: [ogImage],
    },
  };
}

/** Suggested starting comparisons, shown only when all slugs resolve. */
const SAMPLE_COMPARISONS: readonly string[][] = [
  ["metformin", "glipizide"],
  ["lisinopril", "losartan"],
  ["atorvastatin", "rosuvastatin", "simvastatin"],
  ["sertraline", "fluoxetine", "escitalopram"],
];

export default async function ComparePage({ searchParams }: PageProps) {
  const slugs = parseSlugs((await searchParams).drugs);
  const repo = getRepository();

  const [resolved, sampleResolution] = await Promise.all([
    Promise.all(
      slugs.map(async (slug) => {
        const drug = await repo.getDrug(slug);
        if (!drug) return { slug, drug: null, structure: null, structureSvg: null };
        const structure = getSeedStructure(slug);
        const structureSvg = structure
          ? await loadStructureSvg(structure.structureSvgPath)
          : null;
        return { slug, drug, structure, structureSvg };
      }),
    ),
    repo.getDrugsBatch(SAMPLE_COMPARISONS.flat()),
  ]);
  const sampleSlugs = new Set(sampleResolution.found.map((d) => d.slug));
  const samples = SAMPLE_COMPARISONS.filter((pair) =>
    pair.every((slug) => sampleSlugs.has(slug)),
  );

  const known = resolved.filter(
    (r): r is {
      slug: string;
      drug: Drug;
      structure: ChemicalStructure | null;
      structureSvg: string | null;
    } => r.drug !== null,
  );
  const missing = resolved.filter((r) => r.drug === null).map((r) => r.slug);

  const pairInteractions =
    known.length >= 2
      ? (
          await repo.checkInteractions(known.map((k) => k.drug.slug))
        ).pairs
      : [];

  const columnCount = known.length;
  const columnsClass =
    columnCount === 1
      ? "md:grid-cols-2"
      : columnCount === 2
        ? "md:grid-cols-3"
        : "md:grid-cols-4";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: "Compare" }]} />

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            Compare drugs
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
            Put two or three records next to each other and contrast their
            class, mechanism, indications, identifiers, and chemistry. Reads
            straight from the existing drug records — a reference contrast,
            never a recommendation.
          </p>
        </div>
      </div>

      <CompareDrugPicker
        selected={known.map((k) => ({ slug: k.drug.slug, name: k.drug.name }))}
        maxDrugs={MAX_DRUGS}
      />

      {missing.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          Could not resolve: {missing.map((m) => (
            <code key={m} className="ml-1 font-mono text-xs">{m}</code>
          ))}
        </div>
      )}

      {known.length === 0 ? (
        <EmptyState samples={samples} />
      ) : (
        <div className="mt-10 space-y-10">
          {pairInteractions.length > 0 && (
            <PairInteractions interactions={pairInteractions} />
          )}

          <ComparisonGrid
            columns={known}
            columnsClass={columnsClass}
          />

          <DisclaimerNote />
        </div>
      )}
    </div>
  );
}

function EmptyState({ samples }: { samples: readonly string[][] }) {
  const sample = samples;

  return (
    <div className="mt-10 rounded-lg border border-border/60 bg-card/40 p-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Try one of these
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {sample.map((pair) => (
          <li key={pair.join("-")}>
            <Link
              href={`/compare?drugs=${pair.join(",")}`}
              className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="font-mono text-sm" translate="no">
                {pair.join(" vs ")}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
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

interface Column {
  slug: string;
  drug: Drug;
  structure: ChemicalStructure | null;
  structureSvg: string | null;
}

function ComparisonGrid({
  columns,
  columnsClass,
}: {
  columns: Column[];
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

function CellContent({ row, column }: { row: RowId; column: Column }) {
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
  if (drug.identifiers.rxcui) rows.push({ label: "RxCUI", value: drug.identifiers.rxcui });
  if (drug.identifiers.atc.length > 0)
    rows.push({ label: "ATC", value: drug.identifiers.atc.join(", ") });
  if (drug.identifiers.unii) rows.push({ label: "UNII", value: drug.identifiers.unii });
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

function PairInteractions({ interactions }: { interactions: Interaction[] }) {
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

function DisclaimerNote() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Note. </span>
      Side-by-side data is taken verbatim from each drug record. pharmacopeia
      is for educational and informational use only and is not a substitute
      for professional medical advice.
    </div>
  );
}
