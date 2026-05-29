import { invalid, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import {
  DrugsBatchRequestSchema,
  type DrugsBatchResponse,
} from "@/lib/schemas";

/**
 * POST /api/v1/drugs/batch
 *
 * Resolve up to 100 drug slugs in a single round-trip. Consumers that
 * would otherwise fan out N requests for N drugs (compare views,
 * spreadsheet imports, agent prompts) get the same records in one call
 * with the same schemas. Duplicates in the request are collapsed and
 * unresolved slugs come back under `missing` so the caller never has
 * to diff request vs. response themselves.
 *
 * Capped at 100 slugs per call to keep the surface bounded; the
 * existing per-record cache headers handle repeat traffic. This is the
 * "batch lookup" endpoint, not a search — pass slugs you already know.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid("Body must be valid JSON");
  }

  const parsed = DrugsBatchRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid(
      "Invalid drugs/batch request",
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    );
  }

  const { found, missing } = await getRepository().getDrugsBatch(
    parsed.data.slugs,
  );
  const body: DrugsBatchResponse = {
    found,
    missing,
    total: found.length,
  };
  return ok(body, { cacheControl: "public, s-maxage=300" });
}

export async function GET() {
  return invalid(
    "Use POST with JSON body { slugs: string[] } to batch-resolve drugs",
  );
}
