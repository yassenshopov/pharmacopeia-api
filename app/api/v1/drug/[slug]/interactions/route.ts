import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { DrugInteractionsResponse } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const interactions = await repo.getDrugInteractions(slug);
  return ok({
    drug: { slug: drug.slug, name: drug.name },
    interactions,
    total: interactions.length,
  } satisfies DrugInteractionsResponse);
}
