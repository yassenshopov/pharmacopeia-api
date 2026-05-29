import { invalid, ok, serverError } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import { InvalidSmilesError } from "@/lib/data/structure-search";
import {
  StructureSearchRequestSchema,
  type StructureSearchResponse,
} from "@/lib/schemas";

/**
 * POST /api/v1/structure-search
 *
 * Body: { smiles: string, limit?: number, threshold?: number }
 *
 * Returns drugs in the dataset ranked by 2D Tanimoto similarity to the
 * caller-supplied SMILES, using the same OpenChemLib fingerprint family
 * that backs `/api/v1/drug/{slug}/similar`. Structural proximity only —
 * never a claim of therapeutic equivalence.
 *
 * POST is used because SMILES strings can contain characters (`#`, `\`,
 * `+`, `/`) that are awkward to round-trip through URL params; GET is
 * also supported for quick exploration with simple SMILES.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Body must be valid JSON");
  }
  return runSearch(body);
}

/**
 * GET /api/v1/structure-search?smiles=...&limit=...&threshold=...
 *
 * Convenience entry point for short, URL-safe SMILES. For anything with
 * stereochemistry or charges, prefer POST.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const smiles = url.searchParams.get("smiles");
  if (!smiles) {
    return invalid("Query parameter 'smiles' is required");
  }
  const limit = url.searchParams.get("limit");
  const threshold = url.searchParams.get("threshold");
  return runSearch({
    smiles,
    ...(limit !== null ? { limit: Number.parseInt(limit, 10) } : {}),
    ...(threshold !== null ? { threshold: Number.parseFloat(threshold) } : {}),
  });
}

async function runSearch(input: unknown) {
  const parsed = StructureSearchRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalid("Invalid structure-search request", parsed.error.issues);
  }
  const { smiles, limit, threshold } = parsed.data;

  try {
    const results = await getRepository().searchByStructure(smiles, {
      limit,
      threshold,
    });
    const response: StructureSearchResponse = {
      query: { smiles, limit, threshold },
      method: "tanimoto-2d-fingerprint",
      total: results.length,
      results,
    };
    return ok(response);
  } catch (err) {
    if (err instanceof InvalidSmilesError) {
      return invalid(err.message);
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return serverError(`Structure search failed: ${msg}`);
  }
}
