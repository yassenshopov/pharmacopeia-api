import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

/**
 * GET /api/v1/mechanisms/graph
 *
 * Mechanism-of-action graph: a tripartite network of drugs, the
 * mechanism-of-action classes they belong to, and the molecular targets
 * they act on. Suitable for force-directed rendering. Educational
 * structural view only — not a claim of clinical equivalence.
 */
export async function GET(request: Request) {
  const graph = await getRepository().getMechanismGraph();
  const counts = graph.nodes.reduce(
    (acc, n) => {
      acc[n.type] += 1;
      return acc;
    },
    { drug: 0, moa: 0, target: 0 } as Record<string, number>,
  );
  return ok(
    {
      method: "class-membership + label-derived targets",
      counts: { ...counts, links: graph.links.length },
      ...graph,
    },
    { request },
  );
}
