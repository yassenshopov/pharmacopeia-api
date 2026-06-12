import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import { TRIALS_DISCLAIMER } from "@/lib/schemas";
import type { DrugTrialsResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/trials
 *
 * ClinicalTrials.gov registrations naming this drug as an
 * intervention: the most recently updated registrations sampled at
 * ingest time, plus the registry's total match count. Registration is
 * NOT evidence of efficacy or safety — `disclaimer` ships inside the
 * payload so downstream consumers inherit the framing. An empty list
 * means no snapshot was kept for this drug, not "no trials exist".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const snapshot = await repo.getDrugTrials(slug);
  const body: DrugTrialsResponse = {
    drug: { slug: drug.slug, name: drug.name },
    trials: snapshot?.trials ?? [],
    totalCount: snapshot?.totalCount ?? 0,
    sampled: snapshot?.trials.length ?? 0,
    disclaimer: TRIALS_DISCLAIMER,
  };
  return ok(body, { request });
}
