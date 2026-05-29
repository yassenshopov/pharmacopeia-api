import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CodeBlock } from "@/components/code-block";
import { StructureSearchClient } from "@/components/structure-search-client";
import { SEED_DRUGS_BY_SLUG } from "@/lib/data/seed/drugs";
import { SEED_STRUCTURES } from "@/lib/data/seed/structures";
import { indexedStructureCount } from "@/lib/data/structure-search";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const STRUCTURE_SEARCH_PATH = "/structure-search";
const STRUCTURE_SEARCH_TITLE = "Structure search";
const STRUCTURE_SEARCH_DESCRIPTION =
  "Paste a SMILES string and find the structurally closest drugs in the dataset, ranked by 2D Tanimoto similarity. Structural proximity only — never therapeutic equivalence.";

const SAMPLE_CURL = `curl -X POST https://pharmacopeia.dev/api/v1/structure-search \\
  -H "Content-Type: application/json" \\
  -d '{"smiles": "CC(=O)NC1=CC=C(C=C1)O", "limit": 10, "threshold": 0.4}'`;

/**
 * Curated example queries showcasing distinct chemotypes that have
 * obvious neighbours in the dataset — useful both as a starting point
 * for new users and as a sanity check that the index is alive.
 */
const EXAMPLE_SLUGS: readonly string[] = [
  "ibuprofen",
  "atorvastatin",
  "lisinopril",
  "metformin",
  "sertraline",
  "acetaminophen",
];

export const metadata: Metadata = {
  title: STRUCTURE_SEARCH_TITLE,
  description: STRUCTURE_SEARCH_DESCRIPTION,
  alternates: { canonical: absoluteUrl(STRUCTURE_SEARCH_PATH) },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: STRUCTURE_SEARCH_TITLE,
    description: STRUCTURE_SEARCH_DESCRIPTION,
    url: absoluteUrl(STRUCTURE_SEARCH_PATH),
    images: [
      {
        url: ogImageUrl({
          title: "Structure search",
          subtitle: "SMILES → nearest drugs",
        }),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — structure search`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: STRUCTURE_SEARCH_TITLE,
    description: STRUCTURE_SEARCH_DESCRIPTION,
  },
};

interface Example {
  slug: string;
  name: string;
  smiles: string;
}

export default function StructureSearchPage() {
  const examples: Example[] = [];
  for (const slug of EXAMPLE_SLUGS) {
    const drug = SEED_DRUGS_BY_SLUG[slug];
    const struct = SEED_STRUCTURES[slug];
    if (!drug || !struct) continue;
    examples.push({ slug, name: drug.name, smiles: struct.smiles });
  }

  const indexedCount = indexedStructureCount();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: "Structure search" }]} />

      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            Structure search
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Paste a SMILES and we&apos;ll rank every drug in the dataset by
            2D Tanimoto similarity, using the same OpenChemLib fingerprint
            family that backs each drug&apos;s structural-analogs list.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {indexedCount} drugs indexed · Tanimoto over 512-bit OCL
            substructure fingerprints · structural proximity only
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">POST</div>
          <code translate="no">/api/v1/structure-search</code>
        </div>
      </div>

      <StructureSearchClient
        examples={examples}
        indexedCount={indexedCount}
      />

      <section className="mt-14">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Try the API
        </h2>
        <CodeBlock code={SAMPLE_CURL} label="cURL" language="bash" />
      </section>

      <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note. </span>
        pharmacopeia is for educational and informational use only.
        Structural similarity is a chemistry signal — never a clinical
        one. Two drugs can be structurally identical and still differ in
        salt form, formulation, half-life, indication, or safety
        profile.
      </div>
    </div>
  );
}
