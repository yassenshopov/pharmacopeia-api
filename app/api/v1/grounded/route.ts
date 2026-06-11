import { invalid, ok, unauthorized } from "@/lib/api/response";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { getRepository } from "@/lib/data/repository";
import {
  GroundedRequestSchema,
  SEMANTIC_DISCLAIMER,
  type GroundedCitation,
  type GroundedPassage,
  type GroundedResponse,
} from "@/lib/schemas";

/**
 * POST /api/v1/grounded — the paid retrieval tier.
 *
 * Same retrieval as /v1/semantic-search, repackaged for LLM consumers:
 * every passage carries a citation id and a full-coverage span →
 * citation mapping, and every citation carries the record's provenance
 * (canonical source URL, content hash, extraction timestamp,
 * confidence) plus a permalink to the human-readable page. Passages
 * are verbatim spans of a single source record, so one span per
 * passage covers every token an LLM might quote.
 *
 * Requires an API key (`Authorization: Bearer pk_live_...`), minted by
 * `npm run keys:create` or listed in PHARMACOPEIA_API_KEYS.
 */
export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid("Request body must be JSON");
  }
  const parsed = GroundedRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid(
      "Invalid request body",
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    );
  }
  const { query, limit, sections } = parsed.data;

  const { method, model, results } = await getRepository().searchPassages(
    query,
    { limit, sections },
  );

  const origin = new URL(request.url).origin;
  const citations: GroundedCitation[] = [];
  const passages: GroundedPassage[] = results.map((p, i) => {
    const citationId = `c${i + 1}`;
    citations.push({
      id: citationId,
      drug: p.drug,
      section: p.section,
      passageId: p.id,
      url: `${origin}/drug/${p.drug.slug}`,
      provenance: p.provenance,
    });
    return {
      id: p.id,
      citationId,
      drug: p.drug,
      section: p.section,
      chunk: p.chunk,
      text: p.text,
      score: p.score,
      grounding: [{ start: 0, end: p.text.length, citationId }],
    };
  });

  return ok(
    {
      query,
      method,
      ...(model ? { model } : {}),
      passages,
      citations,
      usage: {
        tier: auth.tier,
        ...(auth.requestCount !== undefined
          ? { requestCount: auth.requestCount }
          : {}),
      },
      disclaimer: SEMANTIC_DISCLAIMER,
    } satisfies GroundedResponse,
    { cacheControl: "no-store" },
  );
}

export async function GET() {
  return invalid(
    'Use POST with JSON body { query, limit?, sections? } and an API key (Authorization: Bearer <key>)',
  );
}
