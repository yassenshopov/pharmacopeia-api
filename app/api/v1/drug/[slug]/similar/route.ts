import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { SimilarDrugsResponse } from "@/lib/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const similar = await repo.getSimilarDrugs(slug);
  return ok(
    {
      drug: { slug: drug.slug, name: drug.name },
      method: "tanimoto-2d-fingerprint",
      similar,
      total: similar.length,
    } satisfies SimilarDrugsResponse,
    { request },
  );
}
