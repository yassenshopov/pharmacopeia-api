import { notFound, ok } from "@/lib/api/response";
import { applyDrugSparseFields, parseDrugFields } from "@/lib/api/sparse";
import { getRepository } from "@/lib/data/repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const drug = await getRepository().getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const url = new URL(request.url);
  const fields = parseDrugFields(url.searchParams.get("fields"));
  return ok(applyDrugSparseFields(drug, fields), { request });
}
