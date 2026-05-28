import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { BrandsResponse } from "@/lib/schemas";

export async function GET() {
  const brands = await getRepository().listBrands();
  return ok({ brands, total: brands.length } satisfies BrandsResponse);
}
