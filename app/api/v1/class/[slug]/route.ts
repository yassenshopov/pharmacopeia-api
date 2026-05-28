import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const cls = await repo.getClass(slug);
  if (!cls) return notFound(`Class '${slug}' not found`);

  const { items: drugs } = await repo.listDrugs({ classSlug: slug, limit: 200 });
  return ok({ ...cls, drugs });
}
