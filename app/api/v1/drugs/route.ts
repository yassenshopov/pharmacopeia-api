import { invalid, ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import { JurisdictionSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { limit, offset } = parseLimitOffset(url);
  const classSlug = url.searchParams.get("class") ?? undefined;
  const ingredientSlug = url.searchParams.get("ingredient") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const jurisdictionRaw = url.searchParams.get("jurisdiction");
  let jurisdiction;
  if (jurisdictionRaw !== null) {
    const parsed = JurisdictionSchema.safeParse(jurisdictionRaw);
    if (!parsed.success) {
      return invalid(
        `Unknown jurisdiction '${jurisdictionRaw}'. Expected one of: ${JurisdictionSchema.options.join(", ")}.`,
      );
    }
    jurisdiction = parsed.data;
  }

  const result = await getRepository().listDrugs({
    limit,
    offset,
    classSlug,
    ingredientSlug,
    q,
    jurisdiction,
  });

  return ok(result, { request });
}
