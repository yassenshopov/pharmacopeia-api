import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import {
  PlainLanguageNotice,
  PlainLanguageProvider,
  PlainLanguageToggle,
  ProseText,
} from "@/components/plain-language";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { Toc, type TocItem } from "@/components/toc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { slugifyReactionName } from "@/lib/data/reactions-index";
import { getRepository } from "@/lib/data/repository";
import {
  fleschKincaidGrade,
  simplifyClinicalSegments,
  simplifyClinicalText,
} from "@/lib/plain-language";
import type {
  ChemicalStructure,
  Drug,
  Severity,
  ShortageStatus,
} from "@/lib/schemas";
import { drugJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const EXTRACTED_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * Read a pre-generated structure SVG from /public and return it as a
 * string for inline rendering. Inlining is required so that
 * `currentColor` (used for bond strokes) resolves against the host
 * page's CSS cascade — when loaded via <img src> the SVG renders in
 * isolation and currentColor falls back to black, making bonds
 * invisible in dark mode.
 */
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

function formatExtractedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return EXTRACTED_DATE_FORMATTER.format(date);
}

/**
 * Render a FAERS reaction count as a share of `totalReports`. openFDA
 * counts each reaction across the matched documents, so the value is
 * "X% of FAERS reports for this drug mentioned this reaction". A single
 * report can list many reactions, so the rendered shares routinely sum
 * to >100% — that's expected, not a bug. We collapse very small shares
 * to `<0.1%` and skip decimals at the high end where they're noise.
 */
/** "ACTIVE_NOT_RECRUITING" → "Active not recruiting", "PHASE2" → "Phase 2". */
function formatRegistryToken(token: string): string {
  const words = token
    .replace(/PHASE(\d)/g, "PHASE $1")
    .split("_")
    .join(" ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatReactionShare(count: number, totalReports: number): string {
  if (totalReports <= 0 || count <= 0) return "—";
  const pct = (count / totalReports) * 100;
  if (pct < 0.1) return "<0.1%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

function drugDescription(drug: Drug): string {
  const lead = `Mechanism, dosing, interactions, and identifiers for ${drug.name}.`;
  const detail =
    drug.shortDescription ?? drug.mechanism?.summary ?? "";
  return truncate(detail ? `${lead} ${detail}` : lead);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const drug = await getRepository().getDrug(slug);

  if (!drug) {
    return {
      title: "Drug not found",
      description: "The requested drug record was not found in pharmacopeia.",
      robots: { index: false, follow: false },
    };
  }

  const description = drugDescription(drug);
  const url = absoluteUrl(`/drugs/${drug.slug}`);
  const classSummary = drug.classes[0]?.name ?? "Reference record";
  const ogImage = ogImageUrl({
    title: drug.name,
    subtitle: classSummary,
  });

  return {
    title: drug.name,
    description,
    keywords: [
      drug.name,
      ...drug.synonyms,
      ...drug.brands,
      ...drug.classes.map((c) => c.name),
      ...drug.ingredients.map((i) => i.name),
      "drug reference",
      "rxnorm",
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: drug.name,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${drug.name} — ${classSummary}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: drug.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function DrugDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) notFound();

  const interactions = await repo.getDrugInteractions(slug);
  const similar = await repo.getSimilarDrugs(slug);
  const shortages = await repo.getDrugShortages(slug);
  const activeShortages = shortages.filter((s) => s.status === "active");
  const adverseEvents = await repo.getAdverseEventStats(slug);
  const literature = await repo.getDrugLiterature(slug);
  const trialsSnapshot = await repo.getDrugTrials(slug);
  const pgxSnapshot = await repo.getDrugPgx(slug);
  const structure = getSeedStructure(slug);
  const structureSvg = structure
    ? await loadStructureSvg(structure.structureSvgPath)
    : null;

  const ls = drug.labelSections;
  const tocItems: TocItem[] = [];
  if (ls?.boxedWarning)
    tocItems.push({ id: "boxed-warning", label: "Boxed warning" });
  if (drug.mechanism) tocItems.push({ id: "mechanism", label: "Mechanism" });
  if (drug.indications.length > 0)
    tocItems.push({ id: "indications", label: "Indications" });
  if (drug.contraindications.length > 0)
    tocItems.push({ id: "contraindications", label: "Contraindications" });
  if (ls?.dosageAndAdministration || drug.dosing.length > 0)
    tocItems.push({ id: "dosing", label: "Dosing" });
  if (ls?.warningsAndPrecautions)
    tocItems.push({ id: "warnings", label: "Warnings" });
  if (ls?.adverseReactions)
    tocItems.push({ id: "adverse-reactions", label: "Adverse reactions" });
  if (ls?.useInSpecificPopulations)
    tocItems.push({ id: "populations", label: "Special populations" });
  if (drug.pharmacokinetics)
    tocItems.push({ id: "pharmacokinetics", label: "Pharmacokinetics" });
  if (interactions.length > 0)
    tocItems.push({ id: "interactions", label: "Interactions" });
  if (ls?.overdosage) tocItems.push({ id: "overdosage", label: "Overdosage" });
  if (drug.approvalHistory.length > 0)
    tocItems.push({ id: "approvals", label: "Approval history" });
  if (shortages.length > 0)
    tocItems.push({ id: "shortages", label: "FDA shortages" });
  if (adverseEvents && adverseEvents.topReactions.length > 0)
    tocItems.push({ id: "adverse-events", label: "FAERS reports" });
  if (literature.length > 0)
    tocItems.push({ id: "literature", label: "Literature" });
  if (trialsSnapshot && trialsSnapshot.trials.length > 0)
    tocItems.push({ id: "trials", label: "Clinical trials" });
  if (pgxSnapshot && pgxSnapshot.pairs.length > 0)
    tocItems.push({ id: "pharmacogenomics", label: "Pharmacogenomics" });
  if (similar.length > 0)
    tocItems.push({ id: "analogs", label: "Structural analogs" });

  const proseTexts = [
    ls?.boxedWarning,
    drug.mechanism?.summary,
    ...drug.indications.map((i) => i.text),
    ...drug.contraindications.map((c) => c.text),
    ls?.dosageAndAdministration,
    ...drug.dosing.map((d) => d.notes),
    ls?.warningsAndPrecautions,
    ls?.adverseReactions,
    ls?.useInSpecificPopulations,
    ls?.overdosage,
    ...interactions.flatMap((x) => [x.description, x.recommendation]),
  ].filter((t): t is string => Boolean(t));
  const plainGrade = fleschKincaidGrade(
    proseTexts.map(simplifyClinicalText).join(" "),
  );

  return (
    <PlainLanguageProvider>
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <script {...jsonLdScriptProps(drugJsonLd(drug))} />

      <Breadcrumbs
        items={[
          { label: "Drugs", href: "/drugs" },
          { label: drug.name },
        ]}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            {drug.name}
          </h1>
          {drug.shortDescription && (
            <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
              {drug.shortDescription}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {drug.classes.map((c) => (
              <Link
                key={c.slug}
                href={`/classes/${c.slug}`}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Badge variant="secondary" className="hover:bg-accent">
                  {c.name}
                </Badge>
              </Link>
            ))}
            <Badge variant="outline" className="font-mono text-[10px]" translate="no">
              {drug.jurisdiction}
            </Badge>
            <ProvenanceBadge provenance={drug.provenance} variant="inline" />
            {activeShortages.length > 0 && (
              <a
                href="#shortages"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none dark:text-amber-300"
                aria-label={`${activeShortages.length} active FDA shortage entr${activeShortages.length === 1 ? "y" : "ies"} — jump to details`}
              >
                <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                FDA shortage
                {activeShortages.length > 1 ? ` ×${activeShortages.length}` : ""}
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <PlainLanguageToggle />
          <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
            <div className="mb-2 text-muted-foreground">GET</div>
            <code translate="no">/api/v1/drug/{drug.slug}</code>
          </div>
        </div>
      </div>

      <PlainLanguageNotice grade={plainGrade} />

      {ls?.boxedWarning && (
        <section
          id="boxed-warning"
          aria-labelledby="boxed-warning-title"
          className="mt-8 scroll-mt-24 rounded-lg border border-red-500/40 bg-red-500/5 p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="h-4 w-4 text-red-600 dark:text-red-400"
            />
            <h2
              id="boxed-warning-title"
              className="text-sm font-semibold uppercase tracking-wider text-red-700 dark:text-red-300"
            >
              Boxed warning
            </h2>
          </div>
          <p className="text-sm text-foreground/90">
            <Prose text={ls.boxedWarning} />
          </p>
        </section>
      )}

      {structure && (
        <StructureCard
          drug={drug}
          structure={structure}
          structureSvg={structureSvg}
        />
      )}

      <Separator className="my-10" />

      {/* ─────────────────────────────── Sections */}
      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {drug.mechanism && (
            <Section
              id="mechanism"
              title="Mechanism of action"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <p>
                <Prose text={drug.mechanism.summary} />
              </p>
              {drug.mechanism.targets.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {drug.mechanism.targets.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="font-mono text-[10px]"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>
          )}

          {drug.indications.length > 0 && (
            <Section
              id="indications"
              title="Indications"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <ul className="space-y-3">
                {drug.indications.map((ind, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-4 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>
                      <Prose text={ind.text} />
                    </span>
                    {ind.icd10.length > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ICD-10: {ind.icd10.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {drug.contraindications.length > 0 && (
            <Section
              id="contraindications"
              title="Contraindications"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <ul className="space-y-3">
                {drug.contraindications.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-4 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>
                      <Prose text={c.text} />
                    </span>
                    <SeverityBadge severity={c.severity} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(ls?.dosageAndAdministration || drug.dosing.length > 0) && (
            <Section
              id="dosing"
              title="Dosage & administration"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              {ls?.dosageAndAdministration && (
                <p className="text-sm leading-relaxed text-foreground/90">
                  <Prose text={ls.dosageAndAdministration} />
                </p>
              )}
              {drug.dosing.length > 0 && (
              <ul className="mt-4 space-y-3">
                {drug.dosing.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/60 px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {d.dose}{" "}
                        {d.frequency && (
                          <span className="text-muted-foreground">
                            · {d.frequency}
                          </span>
                        )}
                      </span>
                      <span className="flex gap-1 font-mono text-[10px] text-muted-foreground">
                        <span className="rounded border border-border/60 px-1.5 py-0.5">
                          {d.route}
                        </span>
                        <span className="rounded border border-border/60 px-1.5 py-0.5">
                          {d.population}
                        </span>
                      </span>
                    </div>
                    {d.condition && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Condition: {d.condition}
                      </div>
                    )}
                    {d.maxDose && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Max: {d.maxDose}
                      </div>
                    )}
                    {d.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <Prose text={d.notes} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              )}
            </Section>
          )}

          {ls?.warningsAndPrecautions && (
            <Section
              id="warnings"
              title="Warnings & precautions"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <p className="text-sm leading-relaxed text-foreground/90">
                <Prose text={ls.warningsAndPrecautions} />
              </p>
            </Section>
          )}

          {ls?.adverseReactions && (
            <Section
              id="adverse-reactions"
              title="Adverse reactions"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <p className="text-sm leading-relaxed text-foreground/90">
                <Prose text={ls.adverseReactions} />
              </p>
            </Section>
          )}

          {ls?.useInSpecificPopulations && (
            <Section
              id="populations"
              title="Use in specific populations"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <p className="text-sm leading-relaxed text-foreground/90">
                <Prose text={ls.useInSpecificPopulations} />
              </p>
            </Section>
          )}

          {drug.pharmacokinetics && (
            <Section
              id="pharmacokinetics"
              title="Pharmacokinetics"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr_max-content_1fr]">
                {drug.pharmacokinetics.halfLife && (
                  <KV
                    label="Half-life"
                    value={drug.pharmacokinetics.halfLife}
                  />
                )}
                {drug.pharmacokinetics.tMax && (
                  <KV label="Tmax" value={drug.pharmacokinetics.tMax} />
                )}
                {drug.pharmacokinetics.bioavailability && (
                  <KV
                    label="Bioavailability"
                    value={drug.pharmacokinetics.bioavailability}
                  />
                )}
                {drug.pharmacokinetics.proteinBinding && (
                  <KV
                    label="Protein binding"
                    value={drug.pharmacokinetics.proteinBinding}
                  />
                )}
                {drug.pharmacokinetics.metabolism && (
                  <KV
                    label="Metabolism"
                    value={drug.pharmacokinetics.metabolism}
                  />
                )}
                {drug.pharmacokinetics.excretion && (
                  <KV
                    label="Excretion"
                    value={drug.pharmacokinetics.excretion}
                  />
                )}
              </dl>
            </Section>
          )}

          {interactions.length > 0 && (
            <Section
              id="interactions"
              title="Interactions"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/interactions`}
                  aria-label={`View interactions for ${drug.name} as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <ul className="space-y-3">
                {interactions.map((x, i) => {
                  const other = x.drugA === drug.slug ? x.drugB : x.drugA;
                  return (
                    <li
                      key={i}
                      className="rounded-md border border-border/60 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/drugs/${other}`}
                          translate="no"
                          className="rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {other}
                        </Link>
                        <SeverityBadge severity={x.severity} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        <Prose text={x.description} />
                      </p>
                      {x.recommendation && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Recommendation:{" "}
                          </span>
                          <Prose text={x.recommendation} />
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {ls?.overdosage && (
            <Section
              id="overdosage"
              title="Overdosage"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <p className="text-sm leading-relaxed text-foreground/90">
                <Prose text={ls.overdosage} />
              </p>
            </Section>
          )}

          {drug.approvalHistory.length > 0 && (
            <Section
              id="approvals"
              title="Approval history"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <ul className="space-y-2">
                {drug.approvalHistory.map((a, i) => (
                  <li
                    key={`${a.applicationNumber}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs tabular-nums">
                        {formatExtractedDate(a.date)}
                      </span>
                      <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {a.type}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {a.applicationNumber}
                      </span>
                    </span>
                    {a.sponsor && (
                      <span className="text-xs text-muted-foreground">
                        {a.sponsor}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {shortages.length > 0 && (
            <Section
              id="shortages"
              title="FDA shortages"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/shortages`}
                  aria-label={`View ${drug.name} shortage entries as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Reference statistics from the openFDA drug-shortage dataset.
                For a live view, consult the FDA database directly. Not
                clinical guidance.
              </p>
              <ul className="space-y-2">
                {shortages.map((s, i) => (
                  <li
                    key={`${s.presentation}-${i}`}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-medium">{s.presentation}</span>
                      <ShortageStatusBadge status={s.status} />
                    </div>
                    {(s.sponsor || s.reason) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.sponsor && (
                          <span>
                            <span className="font-semibold text-foreground">
                              Sponsor:{" "}
                            </span>
                            {s.sponsor}
                          </span>
                        )}
                        {s.sponsor && s.reason && <span> · </span>}
                        {s.reason && (
                          <span>
                            <span className="font-semibold text-foreground">
                              Reason:{" "}
                            </span>
                            {s.reason}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Updated{" "}
                      <time dateTime={s.fdaUpdatedAt} className="tabular-nums">
                        {formatExtractedDate(s.fdaUpdatedAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {adverseEvents && adverseEvents.topReactions.length > 0 && (
            <Section
              id="adverse-events"
              title="FAERS reports"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/adverse-events`}
                  aria-label={`View ${drug.name} FAERS aggregate counts as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Reference statistics only. </span>
                FAERS reports are <em>voluntarily submitted</em> and are{" "}
                <strong>not</strong> incidence rates, safety signals, or
                causal evidence. Counts reflect reporting volume — how often
                a reaction was reported, not how often it occurs. For
                decision-grade use, consult openFDA and the FAERS Public
                Dashboard directly.
              </div>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {adverseEvents.totalReports.toLocaleString()}
                  </span>{" "}
                  total reports matched
                </span>
                {adverseEvents.windowEnd && (
                  <span>
                    Latest report{" "}
                    <time
                      dateTime={adverseEvents.windowEnd}
                      className="tabular-nums"
                    >
                      {formatExtractedDate(adverseEvents.windowEnd)}
                    </time>
                  </span>
                )}
                <span className="basis-full text-[11px] italic">
                  Share = reports listing the reaction ÷ total matched reports.
                  Rows can sum to &gt;100% because a single report often
                  lists multiple reactions.
                </span>
              </div>
              <ol className="space-y-1">
                {adverseEvents.topReactions.slice(0, 15).map((r, i) => {
                  const share = formatReactionShare(
                    r.count,
                    adverseEvents.totalReports,
                  );
                  const reactionSlug = slugifyReactionName(r.reaction);
                  return (
                    <li
                      key={`${r.reaction}-${i}`}
                      className="flex items-baseline justify-between gap-3 rounded-sm border-b border-border/40 px-1 py-1 text-sm last:border-b-0"
                    >
                      <span className="flex items-baseline gap-3 min-w-0">
                        <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
                        {reactionSlug ? (
                          <Link
                            href={`/reactions/${reactionSlug}`}
                            className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                            aria-label={`Browse drugs reporting ${r.reaction}`}
                          >
                            {r.reaction}
                          </Link>
                        ) : (
                          <span className="truncate">{r.reaction}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                        <span aria-label={`${r.count.toLocaleString()} reports`}>
                          {r.count.toLocaleString()}
                        </span>
                        <span
                          className="w-12 text-right text-foreground/80"
                          aria-label={`${share} of matched reports`}
                        >
                          {share}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {literature.length > 0 && (
            <Section
              id="literature"
              title="Literature"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/literature`}
                  aria-label={`View ${drug.name} PubMed references as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Recent PubMed references pinned to {drug.name} as a MeSH
                major topic. Citations link to pubmed.ncbi.nlm.nih.gov.
              </p>
              <ul className="space-y-3">
                {literature.map((ref) => (
                  <li
                    key={ref.pmid}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <a
                      href={ref.pubmedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {ref.title}
                    </a>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <em>{ref.journal}</em>
                      <span className="tabular-nums"> · {ref.year}</span>
                      {ref.authors.length > 0 && (
                        <>
                          <span> · </span>
                          <span>
                            {ref.authors.join(", ")}
                            {ref.authors.length >= 3 ? ", et al." : ""}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                      <span translate="no">PMID {ref.pmid}</span>
                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                          translate="no"
                        >
                          DOI {ref.doi}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {trialsSnapshot && trialsSnapshot.trials.length > 0 && (
            <Section
              id="trials"
              title="Clinical trials"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/trials`}
                  aria-label={`View ${drug.name} clinical trial registrations as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                The {trialsSnapshot.trials.length} most recently updated of{" "}
                <span className="tabular-nums">
                  {trialsSnapshot.totalCount.toLocaleString("en-US")}
                </span>{" "}
                ClinicalTrials.gov registrations naming {drug.name} as an
                intervention. Registration is not evidence of efficacy or
                safety — reference crosswalk only.
              </p>
              <ul className="space-y-3">
                {trialsSnapshot.trials.map((trial) => (
                  <li
                    key={trial.nctId}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <a
                      href={trial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {trial.title}
                    </a>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span>{formatRegistryToken(trial.overallStatus)}</span>
                      {trial.phases
                        .filter((p) => p !== "NA")
                        .map((p) => (
                          <span key={p}> · {formatRegistryToken(p)}</span>
                        ))}
                      {trial.studyType && (
                        <span> · {formatRegistryToken(trial.studyType)}</span>
                      )}
                      {trial.enrollment !== undefined && (
                        <span className="tabular-nums">
                          {" "}
                          · {trial.enrollment.toLocaleString("en-US")} enrolled
                        </span>
                      )}
                      {trial.leadSponsor && <span> · {trial.leadSponsor}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                      <span translate="no">{trial.nctId}</span>
                      {trial.lastUpdateDate && (
                        <span className="tabular-nums">
                          updated {trial.lastUpdateDate}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pgxSnapshot && pgxSnapshot.pairs.length > 0 && (
            <Section
              id="pharmacogenomics"
              title="Pharmacogenomics"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/pharmacogenomics`}
                  aria-label={`View ${drug.name} pharmacogenomic drug-gene pairs as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                CPIC-curated drug–gene pairs for {drug.name}. Levels describe
                the strength of curated evidence and guideline status — never
                a recommendation to test or to adjust therapy.
              </p>
              <ul className="space-y-3">
                {pgxSnapshot.pairs.map((pair) => (
                  <li
                    key={pair.gene}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono font-medium" translate="no">
                        {pair.gene}
                      </span>
                      {pair.cpicLevel && (
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          CPIC {pair.cpicLevel}
                          {pair.provisional ? " (provisional)" : ""}
                        </span>
                      )}
                      {pair.clinpgxLevel && (
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          ClinPGx {pair.clinpgxLevel}
                        </span>
                      )}
                      {pair.fdaLabelTesting && (
                        <span className="text-xs text-muted-foreground">
                          FDA label: {pair.fdaLabelTesting}
                        </span>
                      )}
                    </div>
                    {pair.guidelineUrl && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <a
                          href={pair.guidelineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {pair.guidelineName ?? "CPIC guideline"}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {similar.length > 0 && (
            <Section
              id="analogs"
              title="Structural analogs"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/similar`}
                  aria-label={`View structural analogs for ${drug.name} as JSON`}
                  className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View JSON
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Ranked by 2D fingerprint (Tanimoto) similarity over PubChem
                structures. Structural proximity only — not a claim of
                therapeutic equivalence.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {similar.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/drugs/${s.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    >
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm font-medium"
                          translate="no"
                        >
                          {s.name}
                        </span>
                        {s.className && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.className}
                          </span>
                        )}
                      </span>
                      <span
                        className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                        title={`Tanimoto similarity ${s.score.toFixed(3)}`}
                      >
                        {(s.score * 100).toFixed(0)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {drug.patientSummary && (
            <Section title="Patient summary">
              <p className="text-sm">{drug.patientSummary}</p>
            </Section>
          )}
        </div>

        {/* ─────────────────────────────── Side panel */}
        <aside className="space-y-8">
          <Section title="Identifiers">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              {drug.identifiers.rxcui && (
                <KV label="RxCUI" value={drug.identifiers.rxcui} />
              )}
              {drug.identifiers.atc.length > 0 && (
                <KV label="ATC" value={drug.identifiers.atc.join(", ")} />
              )}
              {drug.identifiers.drugbank && (
                <KV label="DrugBank" value={drug.identifiers.drugbank} />
              )}
              {drug.identifiers.chembl && (
                <KV label="ChEMBL" value={drug.identifiers.chembl} />
              )}
              {drug.identifiers.pubchem && (
                <KV label="PubChem" value={drug.identifiers.pubchem} />
              )}
              {drug.identifiers.unii && (
                <KV label="UNII" value={drug.identifiers.unii} />
              )}
              {drug.identifiers.ndc.length > 0 && (
                <KV
                  label="NDC"
                  value={drug.identifiers.ndc.slice(0, 2).join(", ")}
                />
              )}
            </dl>
          </Section>

          {drug.brands.length > 0 && (
            <Section title="Brand names">
              <div className="flex flex-wrap gap-1.5">
                {drug.brands.map((b) => (
                  <Badge key={b} variant="outline">
                    {b}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          <Section title="Provenance">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <KV label="Source" value={drug.provenance.extractor} />
              <KV
                label="Confidence"
                value={`${(drug.provenance.confidence * 100).toFixed(0)}%`}
              />
              <KV
                label="Updated"
                value={formatExtractedDate(drug.provenance.extractedAt)}
              />
            </dl>
            <a
              href={drug.provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Source URL for ${drug.name} (opens in a new tab)`}
              className="mt-3 inline-block rounded-sm break-all text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              {drug.provenance.sourceUrl}
            </a>
          </Section>

          <Section title="Try the API">
            <CodeBlock
              code={`curl https://pharmacopeia.dev/api/v1/drug/${drug.slug}`}
              label="cURL"
              language="bash"
            />
          </Section>
        </aside>
      </div>

      <DisclaimerNote drug={drug} />
        </div>
        <Toc items={tocItems} />
      </div>
    </div>
    </PlainLanguageProvider>
  );
}

function StructureCard({
  drug,
  structure,
  structureSvg,
}: {
  drug: Drug;
  structure: ChemicalStructure;
  structureSvg: string | null;
}) {
  const pubchemUrl = structure.pubchemCid
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${structure.pubchemCid}`
    : null;
  return (
    <figure className="mt-8 flex flex-col gap-6 rounded-lg border border-border/80 bg-card/40 p-6 sm:flex-row sm:items-center">
      <div
        role="img"
        aria-label={`2D chemical structure of ${drug.name}`}
        className="block h-auto w-[320px] max-w-full shrink-0 self-center text-foreground/85 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
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
            width={320}
            height={240}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        )}
      </div>
      <figcaption className="min-w-0 flex-1 space-y-2 text-xs text-muted-foreground">
        <div className="text-[10px] font-semibold uppercase tracking-wider">
          2D structure
        </div>
        {structure.iupacName && (
          <div className="italic text-foreground/80">
            {structure.iupacName}
          </div>
        )}
        <div
          className="group/smiles truncate font-mono text-foreground/70 hover:whitespace-normal hover:break-all"
          title={structure.smiles}
          translate="no"
        >
          <span className="text-muted-foreground">SMILES </span>
          {structure.smiles}
        </div>
        {structure.inchiKey && (
          <div className="truncate font-mono" translate="no">
            <span className="text-muted-foreground">InChIKey </span>
            {structure.inchiKey}
          </div>
        )}
        {pubchemUrl && (
          <div>
            <a
              href={pubchemUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${drug.name} on PubChem (opens in a new tab)`}
              className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              View on PubChem
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function Section({
  id,
  title,
  right,
  badge,
  children,
}: {
  id?: string;
  title: string;
  right?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      className={id ? "scroll-mt-24" : undefined}
      aria-labelledby={headingId}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={headingId}
            className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {title}
          </h2>
          {badge}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Clinical prose that participates in the plain-language toggle. The
 * simplified variant is computed here on the server so the client swap
 * is a pure string pick.
 */
function Prose({ text }: { text: string }) {
  return <ProseText clinical={text} plain={simplifyClinicalSegments(text)} />;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-mono text-xs">{value}</dd>
    </>
  );
}

const SEVERITY_COLOR: Record<Severity, string> = {
  contraindicated:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  major: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  moderate:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  minor: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  unknown:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${SEVERITY_COLOR[severity]}`}
    >
      {severity}
    </span>
  );
}

const SHORTAGE_STATUS_COLOR: Record<ShortageStatus, string> = {
  active:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  resolved:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  discontinuation:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  "to-be-discontinued":
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

const SHORTAGE_STATUS_LABEL: Record<ShortageStatus, string> = {
  active: "Active",
  resolved: "Resolved",
  discontinuation: "Discontinued",
  "to-be-discontinued": "To be discontinued",
};

function ShortageStatusBadge({ status }: { status: ShortageStatus }) {
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${SHORTAGE_STATUS_COLOR[status]}`}
    >
      {SHORTAGE_STATUS_LABEL[status]}
    </span>
  );
}

function DisclaimerNote({ drug }: { drug: Drug }) {
  return (
    <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Note. </span>
      Data for <code>{drug.slug}</code> is illustrative MVP content compiled
      from public sources. pharmacopeia is for educational and informational
      use only and is not a substitute for professional medical advice.
    </div>
  );
}
