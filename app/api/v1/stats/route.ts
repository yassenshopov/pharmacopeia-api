import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

export async function GET(request: Request) {
  const stats = await getRepository().getStats();
  return ok(stats, { cacheControl: "public, s-maxage=60", request });
}
