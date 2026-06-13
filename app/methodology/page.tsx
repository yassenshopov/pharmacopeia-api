import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Toc, type TocItem } from "@/components/toc";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";
import {
  articleJsonLd,
  jsonLdScriptProps,
  medicalWebPageJsonLd,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * Editorial / methodology page.
 *
 * For a medical (YMYL) reference, a transparent account of where data
 * comes from, how it is processed, and what its limits are is the single
 * biggest trust signal — for human readers, for search-quality systems,
 * and for the LLMs that cite us. It is deliberately framed as a
 * data-curation account, never a clinical endorsement.
 */

const PATH = "/methodology";
const TITLE = "Methodology & editorial policy";
const DESCRIPTION =
  "How pharmacopeia sources, structures, validates, and updates its medication reference data — public sources, per-record provenance, Zod-validated schemas, and the limits of the dataset.";

const OG_IMAGE = ogImageUrl({
  title: "Methodology",
  subtitle: "Sources, provenance, and editorial policy",
});

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(PATH) },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl(PATH),
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — methodology and editorial policy`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const TOC: TocItem[] = [
  { id: "principles", label: "Principles" },
  { id: "sources", label: "Data sources" },
  { id: "pipeline", label: "How records are built" },
  { id: "provenance", label: "Provenance & confidence" },
  { id: "review", label: "Review & corrections" },
  { id: "updates", label: "Update cadence" },
  { id: "limits", label: "Limitations" },
];

const SOURCES: { name: string; href: string; role: string }[] = [
  {
    name: "openFDA",
    href: "https://open.fda.gov",
    role: "FDA structured product labeling (SPL): indications, warnings, dosing, adverse reactions; drug-shortage and FAERS datasets.",
  },
  {
    name: "RxNorm / RxNav (NLM)",
    href: "https://rxnav.nlm.nih.gov",
    role: "Normalized drug names, ingredient relationships, and RxCUI identifiers — the backbone of the slug + identifier model.",
  },
  {
    name: "DailyMed (NLM)",
    href: "https://dailymed.nlm.nih.gov",
    role: "Source structured product labels behind individual openFDA label records.",
  },
  {
    name: "WHO ATC",
    href: "https://www.whocc.no/atc_ddd_index/",
    role: "Anatomical Therapeutic Chemical classification codes and the class hierarchy.",
  },
  {
    name: "PubChem (NIH)",
    href: "https://pubchem.ncbi.nlm.nih.gov",
    role: "2D chemical structures (SMILES, InChIKey) and the fingerprints behind structural-analog ranking.",
  },
  {
    name: "ICD-10-CM (CMS/NCHS)",
    href: "https://www.cms.gov/medicare/coding-billing/icd-10-codes",
    role: "Public-domain condition codes used to crosswalk labeled indications into the conditions index.",
  },
  {
    name: "ClinicalTrials.gov / PubMed",
    href: "https://clinicaltrials.gov",
    role: "Trial registrations and curated literature references pinned to each drug.",
  },
  {
    name: "CPIC",
    href: "https://cpicpgx.org",
    role: "Curated pharmacogenomic drug–gene pairs and evidence levels.",
  },
];

export default async function MethodologyPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <script
        {...jsonLdScriptProps([
          articleJsonLd({
            title: TITLE,
            description: DESCRIPTION,
            url: PATH,
            dateModified: stats.updatedAt,
          }),
          medicalWebPageJsonLd({
            name: TITLE,
            description: DESCRIPTION,
            url: PATH,
            lastReviewed: stats.updatedAt,
          }),
        ])}
      />

      <Breadcrumbs items={[{ label: "Methodology" }]} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <header className="mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">
              Methodology &amp; editorial policy
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
              How the dataset is built and what it is for. pharmacopeia is a
              reference layer over public medication data — it never
              interprets, recommends, or gives medical advice.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Current snapshot{" "}
              <span className="font-mono" translate="no">
                {stats.version}
              </span>{" "}
              · {stats.drugs.toLocaleString()} drugs ·{" "}
              {stats.classes.toLocaleString()} classes ·{" "}
              {stats.ingredients.toLocaleString()} ingredients.
            </p>
          </header>

          <Prose id="principles" title="Principles">
            <p>
              Every design choice serves one goal: structured public facts
              about medications, served as predictable JSON and browsable
              pages, with a clear audit trail back to an authoritative source.
            </p>
            <ul>
              <li>
                <strong>Reference, never recommendation.</strong> The project
                describes what regulators and the literature say. It does not
                tell anyone what to take, prescribe, or substitute.
              </li>
              <li>
                <strong>Public sources only.</strong> Nothing here depends on
                a paid or licence-restricted feed.
              </li>
              <li>
                <strong>Auditable by construction.</strong> Every record
                carries provenance, so any field can be traced to its origin.
              </li>
              <li>
                <strong>Stable identity.</strong> Entities are keyed by a
                permanent slug; identifiers (RxCUI, UNII, ATC) cross-link to
                external systems.
              </li>
            </ul>
          </Prose>

          <Prose id="sources" title="Data sources">
            <p>
              All data is derived from public, openly licensed sources.
              Each record links to the specific source document it was built
              from.
            </p>
            <dl className="mt-4 space-y-4">
              {SOURCES.map((s) => (
                <div
                  key={s.name}
                  className="rounded-lg border border-border/70 p-4"
                >
                  <dt className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {s.name}
                    </span>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {new URL(s.href).host}
                    </a>
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {s.role}
                  </dd>
                </div>
              ))}
            </dl>
          </Prose>

          <Prose id="pipeline" title="How records are built">
            <p>
              The ingest pipeline resolves a drug from RxNorm, fetches its
              openFDA label, and assembles a single validated record. Narrative
              label sections (boxed warning, indications, dosing, adverse
              reactions) are kept verbatim as reference text; structured fields
              (identifiers, classes, dosing rows) are normalized. Crosswalks
              for ICD-10, DEA scheduling, the FDA Orange Book, structures,
              interactions, shortages, trials, literature, and pharmacogenomics
              are applied conservatively — they only ever fill data, never
              overwrite an existing value, and a missing crosswalk value means
              &ldquo;no confident match,&rdquo; not &ldquo;none exists.&rdquo;
            </p>
            <p>
              Every record is validated against a{" "}
              <Link href="/docs">Zod schema</Link> before it is published; the
              same schema generates the API&apos;s runtime validation and the
              SDK types, so the shape you read here is the shape the API
              guarantees.
            </p>
          </Prose>

          <Prose id="provenance" title="Provenance & confidence">
            <p>
              Each record carries a <code>provenance</code> object:
              the canonical <code>sourceUrl</code>, a{" "}
              <code>sourceHash</code> of the source content, the{" "}
              <code>extractedAt</code> timestamp, the <code>extractor</code>{" "}
              that produced it, and a <code>confidence</code> score.
              AI-extracted content is labeled as such in the interface. For any
              use beyond casual reference, verify the field against the cited{" "}
              <code>sourceUrl</code>.
            </p>
          </Prose>

          <Prose id="review" title="Review & corrections">
            <p>
              Candidate records are gated before publication: a programmatic
              candidate needs a real openFDA label to ship, and records that
              resolve but cannot be grounded in a source are held back for
              review rather than published. Found an error? Every page links
              its source — open an issue on{" "}
              <Link href="/faq">the project repository</Link> with the slug and
              the source discrepancy and it will be corrected at the next
              refresh.
            </p>
          </Prose>

          <Prose id="updates" title="Update cadence">
            <p>
              Refreshes are delta-based: a section is re-fetched only when its
              source content hash changes, and scheduled jobs (for example the
              daily drug-shortage refresh) rebuild their slice straight from
              the upstream source and skip the write when nothing changed. The{" "}
              <Link href="/changelog">changelog</Link> and its{" "}
              <Link href="/feed.xml">feed</Link> record notable dataset
              changes.
            </p>
          </Prose>

          <Prose id="limits" title="Limitations">
            <ul>
              <li>
                Jurisdiction is <strong>US-FDA only</strong> in v0. Labeling,
                availability, and approvals elsewhere will differ.
              </li>
              <li>
                FAERS adverse-event counts are{" "}
                <strong>voluntarily reported volumes</strong>, not incidence
                rates, safety signals, or causal evidence.
              </li>
              <li>
                Crosswalks are precision-biased: absence of a code or link is
                not evidence of absence.
              </li>
              <li>
                This is <strong>not</strong> a clinical decision-support tool,
                an EHR/FHIR layer, a symptom checker, or a diagnostic API.
              </li>
            </ul>
          </Prose>

          <Separator className="mt-16 opacity-50" />
          <p className="mt-6 text-xs text-muted-foreground">
            pharmacopeia is for educational and informational use only. Nothing
            here is medical advice. Always verify against each record&apos;s
            cited source and consult a qualified professional.
          </p>
        </div>
        <Toc items={TOC} />
      </div>
    </div>
  );
}

function Prose({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-14 scroll-mt-24 first:mt-0"
      aria-labelledby={`${id}-title`}
    >
      <h2
        id={`${id}-title`}
        className="mb-4 text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground [&_a]:rounded-sm [&_a]:text-foreground [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
