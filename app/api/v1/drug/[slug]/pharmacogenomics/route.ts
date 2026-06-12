import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import { PGX_DISCLAIMER } from "@/lib/schemas";
import type { DrugPgxResponse } from "@/lib/schemas";

/**
 * GET /api/v1/drug/{slug}/pharmacogenomics
 *
 * CPIC-curated pharmacogenomic drug–gene pairs for a drug: evidence
 * levels (CPIC A–D, ClinPGx 1A–4), FDA-label PGx testing annotations,
 * and guideline links. Evidence metadata only — never testing or
 * dosing guidance; `disclaimer` ships inside the payload so downstream
 * consumers inherit the framing. An empty list means CPIC has no
 * curated pairs for this drug.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const drug = await repo.getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const snapshot = await repo.getDrugPgx(slug);
  const body: DrugPgxResponse = {
    drug: { slug: drug.slug, name: drug.name },
    pairs: snapshot?.pairs ?? [],
    total: snapshot?.pairs.length ?? 0,
    disclaimer: PGX_DISCLAIMER,
  };
  return ok(body, { request });
}
