import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import type { Drug, Severity } from "@/lib/schemas";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const drug = await getRepository().getDrug(slug);
  if (!drug) return { title: "Not found" };
  return {
    title: drug.name,
    description:
      drug.shortDescription ??
      `${drug.name} — mechanism, indications, dosing, identifiers, and interactions.`,
  };
}

export default async function DrugDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) notFound();

  const interactions = await repo.getDrugInteractions(slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* ─────────────────────────────── Header */}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/drugs" className="hover:text-foreground">
          drugs
        </Link>
        <span>/</span>
        <code className="font-mono">{drug.slug}</code>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{drug.name}</h1>
          {drug.shortDescription && (
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {drug.shortDescription}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {drug.classes.map((c) => (
              <Link key={c.slug} href={`/classes/${c.slug}`}>
                <Badge variant="secondary" className="hover:bg-accent">
                  {c.name}
                </Badge>
              </Link>
            ))}
            <Badge variant="outline" className="font-mono text-[10px]">
              {drug.jurisdiction}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code>/api/v1/drug/{drug.slug}</code>
        </div>
      </div>

      <Separator className="my-10" />

      {/* ─────────────────────────────── Sections */}
      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {drug.mechanism && (
            <Section title="Mechanism of action">
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
            <Section title="Indications">
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
            <Section title="Contraindications">
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
            <Section title="Dosing">
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

          {interactions.length > 0 && (
            <Section
              title="Interactions"
              right={
                <Link
                  href={`/api/v1/drug/${drug.slug}/interactions`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  view JSON →
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
                          className="font-semibold hover:underline"
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
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
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

          {drug.pharmacokinetics && (
            <Section title="Pharmacokinetics">
              <dl className="grid grid-cols-3 gap-y-2 text-sm">
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
                    label="Bioavail."
                    value={drug.pharmacokinetics.bioavailability}
                  />
                )}
                {drug.pharmacokinetics.proteinBinding && (
                  <KV
                    label="Protein"
                    value={drug.pharmacokinetics.proteinBinding}
                  />
                )}
                {drug.pharmacokinetics.metabolism && (
                  <KV
                    label="Metab."
                    value={drug.pharmacokinetics.metabolism}
                  />
                )}
                {drug.pharmacokinetics.excretion && (
                  <KV
                    label="Excret."
                    value={drug.pharmacokinetics.excretion}
                  />
                )}
              </dl>
            </Section>
          )}

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
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <KV label="Source" value={drug.provenance.extractor} />
              <KV
                label="Confidence"
                value={`${(drug.provenance.confidence * 100).toFixed(0)}%`}
              />
              <KV
                label="Updated"
                value={new Date(
                  drug.provenance.extractedAt,
                ).toLocaleDateString()}
              />
            </dl>
            <a
              href={drug.provenance.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block break-all text-xs text-muted-foreground hover:text-foreground"
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
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="col-span-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="col-span-2 font-mono text-xs">{value}</dd>
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
