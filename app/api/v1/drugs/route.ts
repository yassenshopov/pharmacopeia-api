import { ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const classSlug = url.searchParams.get("class") ?? undefined;
  const ingredientSlug = url.searchParams.get("ingredient") ?? undefined;

  const result = await getRepository().listDrugs({
    limit,
    offset,
    classSlug,
    ingredientSlug,
  });

  return ok(result);
}
