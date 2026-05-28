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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getSeedStructure } from "@/lib/data/seed/structures";
import { getRepository } from "@/lib/data/repository";
import type { Ingredient } from "@/lib/schemas";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

interface PageProps {
  params: Promise<{ slug: string }>;
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

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function ingredientDescription(ing: Ingredient): string {
  const lead = `Active ingredient ${ing.name} — RxNorm/UNII identifiers and ${ing.drugCount} drug${ing.drugCount === 1 ? "" : "s"} that contain it.`;
  return truncate(ing.molecularFormula ? `${lead} Formula ${ing.molecularFormula}.` : lead);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const ing = await getRepository().getIngredient(slug);

  if (!ing) {
    return {
      title: "Ingredient not found",
      description: "The requested ingredient was not found in pharmacopeia.",
      robots: { index: false, follow: false },
    };
  }

  const description = ingredientDescription(ing);
  const url = absoluteUrl(`/ingredients/${ing.slug}`);
  const ogImage = ogImageUrl({
    title: ing.name,
    subtitle: "Active ingredient",
  });

  return {
    title: ing.name,
    description,
    keywords: [
      ing.name,
      ...ing.synonyms,
      ing.molecularFormula ?? "",
      ing.rxcui ? `RxCUI ${ing.rxcui}` : "",
      ing.unii ? `UNII ${ing.unii}` : "",
      "active ingredient",
      "pharmaceutical ingredient",
    ].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: ing.name,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${ing.name} — active ingredient`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ing.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function IngredientDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const ing = await repo.getIngredient(slug);
  if (!ing) notFound();

  const { items: drugs } = await repo.listDrugs({
    ingredientSlug: slug,
    limit: 200,
  });

  const structure = getSeedStructure(slug);
  const structureSvg = structure
    ? await loadStructureSvg(structure.structureSvgPath)
    : null;
  const pubchemUrl = structure?.pubchemCid
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${structure.pubchemCid}`
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Ingredients", href: "/ingredients" },
          { label: ing.name },
        ]}
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight" translate="no">
            {ing.name}
          </h1>
          {ing.synonyms.length > 0 && (
            <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">also: </span>
              <span translate="no">{ing.synonyms.join(", ")}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {ing.drugCount} {ing.drugCount === 1 ? "drug" : "drugs"}
            </Badge>
            {ing.molecularFormula && (
              <Badge variant="secondary" className="font-mono text-[10px]" translate="no">
                {ing.molecularFormula}
              </Badge>
            )}
            {ing.molecularWeight && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {ing.molecularWeight.toFixed(2)} g/mol
              </Badge>
            )}
            <ProvenanceBadge provenance={ing.provenance} variant="inline" />
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code translate="no">/api/v1/ingredient/{ing.slug}</code>
        </div>
      </div>

      {structure && (
        <figure className="mt-8 flex flex-col gap-6 rounded-lg border border-border/80 bg-card/40 p-6 sm:flex-row sm:items-center">
          <div
            role="img"
            aria-label={`2D chemical structure of ${ing.name}`}
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
              className="truncate font-mono text-foreground/70"
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
                  aria-label={`View ${ing.name} on PubChem (opens in a new tab)`}
                  className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  View on PubChem
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </a>
              </div>
            )}
          </figcaption>
        </figure>
      )}

      <Separator className="my-10" />

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="drugs-title">
            <h2
              id="drugs-title"
              className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Drugs containing {ing.name} ({drugs.length})
            </h2>
            {drugs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drugs in the current dataset list this ingredient.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {drugs.map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/drugs/${d.slug}`}
                      className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    >
                      <span className="font-semibold" translate="no">
                        {d.name}
                      </span>
                      {d.shortDescription && (
                        <span className="mt-1 text-sm text-muted-foreground">
                          {d.shortDescription}
                        </span>
                      )}
                      {d.classes[0] && (
                        <span className="mt-2 text-xs text-muted-foreground">
                          {d.classes[0].name}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <Section title="Identifiers">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              {ing.rxcui && <KV label="RxCUI" value={ing.rxcui} />}
              {ing.unii && <KV label="UNII" value={ing.unii} />}
              {ing.molecularFormula && (
                <KV label="Formula" value={ing.molecularFormula} />
              )}
              {ing.molecularWeight && (
                <KV
                  label="MW"
                  value={`${ing.molecularWeight.toFixed(2)} g/mol`}
                />
              )}
              {ing.smiles && <KV label="SMILES" value={ing.smiles} />}
              {ing.inchikey && <KV label="InChIKey" value={ing.inchikey} />}
            </dl>
          </Section>

          <Section title="Provenance">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <KV label="Source" value={ing.provenance.extractor} />
              <KV
                label="Confidence"
                value={`${(ing.provenance.confidence * 100).toFixed(0)}%`}
              />
              <KV
                label="Updated"
                value={new Date(ing.provenance.extractedAt)
                  .toISOString()
                  .slice(0, 10)}
              />
            </dl>
            <a
              href={ing.provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Source URL for ${ing.name} (opens in a new tab)`}
              className="mt-3 inline-block rounded-sm break-all text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              {ing.provenance.sourceUrl}
            </a>
          </Section>

          <Section title="Try the API">
            <CodeBlock
              code={`curl https://pharmacopeia.dev/api/v1/ingredient/${ing.slug}`}
              label="cURL"
              language="bash"
            />
          </Section>
        </aside>
      </div>

      <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note. </span>
        Ingredient data for <code>{ing.slug}</code> is compiled from public
        sources. pharmacopeia is for educational and informational use only
        and is not a substitute for professional medical advice.
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
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
      <dd className="min-w-0 break-words font-mono text-xs" translate="no">
        {value}
      </dd>
    </>
  );
}
