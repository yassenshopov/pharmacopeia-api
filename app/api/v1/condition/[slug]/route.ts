import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ConditionResponse } from "@/lib/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const condition = await getRepository().getCondition(slug);
  if (!condition) return notFound(`Condition '${slug}' not found`);

  const body: ConditionResponse = condition;
  return ok(body, { request });
}
