import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ingredient = await getRepository().getIngredient(slug);
  if (!ingredient) return notFound(`Ingredient '${slug}' not found`);
  return ok(ingredient);
}
