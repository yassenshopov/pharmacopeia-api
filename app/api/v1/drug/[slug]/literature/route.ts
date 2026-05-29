import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { DrugLiteratureResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/literature
 *
 * Curated PubMed references for a drug. Pinned to MeSH major topic at
 * ingest time so the list is precision-weighted, not a noisy
 * keyword-match. An empty list means no high-quality MeSH match — it
 * does NOT mean no literature exists. Callers wanting recall over
 * precision should hit PubMed E-utilities directly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const references = await repo.getDrugLiterature(slug);
  const body: DrugLiteratureResponse = {
    drug: { slug: drug.slug, name: drug.name },
    references,
    total: references.length,
  };
  return ok(body, { request });
}
