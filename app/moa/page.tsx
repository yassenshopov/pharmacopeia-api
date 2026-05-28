import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MoaGraphClient } from "@/components/moa-graph-client";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const MOA_PATH = "/moa";
const MOA_TITLE = "Mechanism-of-action graph";
const MOA_DESCRIPTION =
  "An interactive network of drugs, the mechanism-of-action classes they belong to, and the molecular targets they act on. Drugs that share a mechanism or target cluster together. Educational structural view only.";

export async function generateMetadata(): Promise<Metadata> {
  const graph = await getRepository().getMechanismGraph();
  const drugs = graph.nodes.filter((n) => n.type === "drug").length;
  const ogImage = ogImageUrl({
    title: "Mechanism-of-action graph",
    subtitle: `${graph.nodes.length} nodes · ${graph.links.length} links`,
  });
  const url = absoluteUrl(MOA_PATH);
  return {
    title: MOA_TITLE,
    description: MOA_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: MOA_TITLE,
      description: MOA_DESCRIPTION,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — mechanism-of-action graph (${drugs} drugs)`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: MOA_TITLE,
      description: MOA_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default async function MoaPage() {
  const graph = await getRepository().getMechanismGraph();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Breadcrumbs items={[{ label: "Mechanism of action" }]} />
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Mechanism of action
          </h1>
          <span className="font-mono text-sm text-muted-foreground">
            {graph.nodes.length} nodes · {graph.links.length} links
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          This force-directed graph joins each drug to the mechanism-of-action
          classes it belongs to and the molecular targets it acts on. Shared
          mechanisms and targets pull related drugs into visible clusters. Toggle
          node types, search to highlight, and click any node to inspect its
          connections.
        </p>
      </div>

      <MoaGraphClient graph={graph} />

      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
        Relationships are derived from public class memberships (NLM RxClass)
        and label-derived targets. This is an educational structural view, not a
        clinical decision-support tool, and must not be used to make medication
        decisions.
      </p>
    </div>
  );
}
