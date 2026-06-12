import { ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ConditionsListResponse } from "@/lib/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const q = url.searchParams.get("q") ?? undefined;

  const { items, pagination } = await getRepository().listConditions({
    limit,
    offset,
    q,
  });

  const body: ConditionsListResponse = { items, pagination };
  return ok(body, { request });
}
