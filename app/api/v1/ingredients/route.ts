import { ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const q = url.searchParams.get("q") ?? undefined;
  const result = await getRepository().listIngredients({ limit, offset, q });
  return ok(result, { request });
}
