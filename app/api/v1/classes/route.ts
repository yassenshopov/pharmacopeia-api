import { ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const result = await getRepository().listClasses({ limit, offset });
  return ok(result, { request });
}
