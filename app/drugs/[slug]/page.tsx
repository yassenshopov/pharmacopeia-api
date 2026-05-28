import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { Toc, type TocItem } from "@/components/toc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { getRepository } from "@/lib/data/repository";
import type { ChemicalStructure, Drug, Severity } from "@/lib/schemas";
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
  const structure = getSeedStructure(slug);
  const structureSvg = structure
    ? await loadStructureSvg(structure.structureSvgPath)
    : null;

  const tocItems: TocItem[] = [];
  if (drug.mechanism) tocItems.push({ id: "mechanism", label: "Mechanism" });
  if (drug.indications.length > 0)
    tocItems.push({ id: "indications", label: "Indications" });
  if (drug.contraindications.length > 0)
    tocItems.push({ id: "contraindications", label: "Contraindications" });
  if (drug.dosing.length > 0) tocItems.push({ id: "dosing", label: "Dosing" });
  if (interactions.length > 0)
    tocItems.push({ id: "interactions", label: "Interactions" });
  if (drug.pharmacokinetics)
    tocItems.push({ id: "pharmacokinetics", label: "Pharmacokinetics" });

  return (
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
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code translate="no">/api/v1/drug/{drug.slug}</code>
        </div>
      </div>

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
              <p>{drug.mechanism.summary}</p>
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
                    <span>{ind.text}</span>
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
                    <span>{c.text}</span>
                    <SeverityBadge severity={c.severity} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {drug.dosing.length > 0 && (
            <Section
              id="dosing"
              title="Dosing"
              badge={
                <ProvenanceBadge
                  provenance={drug.provenance}
                  variant="section"
                />
              }
            >
              <ul className="space-y-3">
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
                        {d.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
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
                        {x.description}
                      </p>
                      {x.recommendation && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Recommendation:{" "}
                          </span>
                          {x.recommendation}
                        </p>
                      )}
                    </li>
                  );
                })}
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
