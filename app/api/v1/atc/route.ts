import { ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";

/**
 * GET /api/v1/atc
 *
 * The full WHO ATC hierarchy as a nested tree (levels 1→5). Levels 1–3
 * carry the WHO group names, level 4 maps to a class record (`slug`),
 * and level 5 leaves are the substances (drugs) in the dataset.
 */
export async function GET() {
  const tree = await getRepository().getAtcTree();
  const groups = tree.length;
  const subgroups = tree.reduce(
    (acc, l1) =>
      acc +
      l1.children.reduce(
        (a, l2) =>
          a +
          l2.children.reduce((b, l3) => b + l3.children.length, 0),
        0,
      ),
    0,
  );
  return ok({ source: "WHO ATC/DDD Index", levels: 5, groups, subgroups, tree });
}
