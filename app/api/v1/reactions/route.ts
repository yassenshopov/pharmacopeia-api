import { ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ReactionsListResponse } from "@/lib/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const q = url.searchParams.get("q") ?? undefined;

  const { items, pagination } = await getRepository().listReactions({
    limit,
    offset,
    q,
  });

  const body: ReactionsListResponse = { items, pagination };
  return ok(body, { request });
}
