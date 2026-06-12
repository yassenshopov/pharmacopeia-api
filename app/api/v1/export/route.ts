import { invalid } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { PharmacopeiaRepository } from "@/lib/data/repository";

/**
 * Bulk dataset export. The most "PokeAPI for X" surface: grab the whole
 * corpus in one request instead of walking thousands of per-record
 * endpoints. Streamed as NDJSON (one JSON record per line) straight from
 * the same repository every other endpoint reads from — so a dump can
 * never disagree with the live API.
 *
 *   GET /api/v1/export                 → JSON index of available dumps
 *   GET /api/v1/export?dataset=drugs   → NDJSON stream of full records
 *
 * Not in the SDK manifest on purpose: like /feed.xml and /llms.txt this
 * is a whole-file artifact, not a typed per-record operation.
 */

export const dynamic = "force-dynamic";

const PAGE = 200;
const BATCH = 100;

type DatasetName = "drugs" | "classes" | "ingredients";

interface DatasetMeta {
  name: DatasetName;
  record: string;
  description: string;
}

const DATASETS: ReadonlyArray<DatasetMeta> = [
  {
    name: "drugs",
    record: "Drug",
    description: "Full drug records, including provenance.",
  },
  {
    name: "classes",
    record: "DrugClass",
    description: "Full drug-class records (FDA EPC, WHO ATC, MoA, MeSH).",
  },
  {
    name: "ingredients",
    record: "Ingredient",
    description: "Full active-ingredient records.",
  },
];

const NDJSON_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/** Drain a paginated list into all of its slugs, in slug order. */
async function allSlugs(
  fetchPage: (opts: {
    limit: number;
    offset: number;
  }) => Promise<{ items: { slug: string }[]; pagination: { total: number } }>,
): Promise<string[]> {
  const slugs: string[] = [];
  const first = await fetchPage({ limit: PAGE, offset: 0 });
  for (const it of first.items) slugs.push(it.slug);
  const total = first.pagination.total;
  while (slugs.length < total) {
    const page = await fetchPage({ limit: PAGE, offset: slugs.length });
    if (page.items.length === 0) break;
    for (const it of page.items) slugs.push(it.slug);
  }
  return slugs;
}

/** Yield each full record of a dataset as a NDJSON line (with newline). */
async function* ndjsonLines(
  repo: PharmacopeiaRepository,
  dataset: DatasetName,
): AsyncGenerator<string> {
  if (dataset === "drugs") {
    // Page summaries for the slug list, then resolve full records in
    // batches so we stream the complete Drug payload, not the summary.
    const slugs = await allSlugs((opts) => repo.listDrugs(opts));
    for (let i = 0; i < slugs.length; i += BATCH) {
      const { found } = await repo.getDrugsBatch(slugs.slice(i, i + BATCH));
      for (const drug of found) yield `${JSON.stringify(drug)}\n`;
    }
    return;
  }

  // Classes and ingredients already return their full records from the
  // list method, so page them straight through.
  const fetchPage =
    dataset === "classes"
      ? (opts: { limit: number; offset: number }) => repo.listClasses(opts)
      : (opts: { limit: number; offset: number }) => repo.listIngredients(opts);
  let offset = 0;
  for (;;) {
    const page = await fetchPage({ limit: PAGE, offset });
    for (const record of page.items) yield `${JSON.stringify(record)}\n`;
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.pagination.total) break;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repo = getRepository();
  const dataset = url.searchParams.get("dataset");

  // No dataset → return the index of available dumps.
  if (!dataset) {
    const stats = await repo.getStats();
    const counts: Record<DatasetName, number> = {
      drugs: stats.drugs,
      classes: stats.classes,
      ingredients: stats.ingredients,
    };
    const body = {
      format: "application/x-ndjson",
      version: stats.version,
      updatedAt: stats.updatedAt,
      license:
        "Aggregated public-source reference data. Educational / informational use only — see /docs for source attributions.",
      datasets: DATASETS.map((d) => ({
        name: d.name,
        record: d.record,
        description: d.description,
        records: counts[d.name],
        url: `/api/v1/export?dataset=${d.name}`,
      })),
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": NDJSON_CACHE,
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const meta = DATASETS.find((d) => d.name === dataset);
  if (!meta) {
    return invalid(
      `Unknown dataset '${dataset}'. Available: ${DATASETS.map((d) => d.name).join(", ")}.`,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of ndjsonLines(repo, meta.name)) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": NDJSON_CACHE,
      "Content-Disposition": `attachment; filename="pharmacopeia-${meta.name}.ndjson"`,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
