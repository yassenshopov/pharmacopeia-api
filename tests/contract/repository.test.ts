import { beforeAll, describe, expect, it } from "vitest";
import type { PharmacopeiaRepository } from "@/lib/data/repository";
import {
  DrugClassSchema,
  DrugSchema,
  DrugSummarySchema,
  IngredientSchema,
  PaginationSchema,
  SearchResultSchema,
} from "@/lib/schemas";

/**
 * Repository contract: behavioural invariants every backend must
 * satisfy. The architectural rule is that the static seed repository
 * and the Postgres repository stay behaviourally identical — this
 * suite is the executable version of that rule.
 *
 * Runs against the static seed always. Set TEST_DATABASE_URL to also
 * run it against the Prisma backend (expects a seeded database).
 */
function repositoryContract(
  name: string,
  getRepo: () => Promise<PharmacopeiaRepository>,
) {
  describe(name, () => {
    let repo: PharmacopeiaRepository;

    beforeAll(async () => {
      repo = await getRepo();
    });

    it("getStats reports a non-empty dataset", async () => {
      const stats = await repo.getStats();
      expect(stats.drugs).toBeGreaterThan(0);
      expect(stats.classes).toBeGreaterThan(0);
      expect(stats.ingredients).toBeGreaterThan(0);
      expect(stats.version).toBeTruthy();
      expect(Date.parse(stats.updatedAt)).not.toBeNaN();
    });

    it("listDrugs paginates with schema-valid summaries", async () => {
      const page = await repo.listDrugs({ limit: 5, offset: 0 });
      expect(PaginationSchema.parse(page.pagination)).toEqual({
        total: page.pagination.total,
        limit: 5,
        offset: 0,
      });
      expect(page.items.length).toBeLessThanOrEqual(5);
      for (const item of page.items) DrugSummarySchema.parse(item);
    });

    it("listDrugs clamps limit to 1..200 and offset to >= 0", async () => {
      const big = await repo.listDrugs({ limit: 10_000 });
      expect(big.pagination.limit).toBe(200);
      const neg = await repo.listDrugs({ limit: -1, offset: -10 });
      expect(neg.pagination.limit).toBe(1);
      expect(neg.pagination.offset).toBe(0);
    });

    it("listDrugs offset windows never overlap and beyond-total is empty", async () => {
      const first = await repo.listDrugs({ limit: 3, offset: 0 });
      const second = await repo.listDrugs({ limit: 3, offset: 3 });
      const firstSlugs = new Set(first.items.map((d) => d.slug));
      for (const d of second.items) {
        expect(firstSlugs.has(d.slug)).toBe(false);
      }

      const beyond = await repo.listDrugs({
        limit: 10,
        offset: first.pagination.total,
      });
      expect(beyond.items).toEqual([]);
      expect(beyond.pagination.total).toBe(first.pagination.total);
    });

    it("getDrug round-trips a listed drug as a schema-valid full record", async () => {
      const { items } = await repo.listDrugs({ limit: 1 });
      expect(items.length).toBe(1);
      const drug = await repo.getDrug(items[0].slug);
      expect(drug).not.toBeNull();
      DrugSchema.parse(drug);
      expect(drug?.slug).toBe(items[0].slug);
      expect(drug?.name).toBe(items[0].name);
    });

    it("getDrug returns null for unknown slugs", async () => {
      expect(await repo.getDrug("definitely-not-a-drug-slug")).toBeNull();
    });

    it("getDrugsBatch dedupes, preserves order, and reports missing", async () => {
      const { items } = await repo.listDrugs({ limit: 2 });
      const [a, b] = items.map((d) => d.slug);
      const result = await repo.getDrugsBatch([a, "nope-1", b, a, "nope-1"]);
      expect(result.found.map((d) => d.slug)).toEqual([a, b]);
      expect(result.missing).toEqual(["nope-1"]);
    });

    it("list q filter matches each entity's search haystack and reports filtered totals", async () => {
      const { items } = await repo.listDrugs({ limit: 1 });
      const drugHit = await repo.listDrugs({ q: items[0].name, limit: 200 });
      expect(drugHit.items.some((d) => d.slug === items[0].slug)).toBe(true);
      expect(drugHit.pagination.total).toBeGreaterThanOrEqual(
        drugHit.items.length,
      );

      const miss = await repo.listDrugs({ q: "zzz-no-such-drug-zzz" });
      expect(miss.items).toEqual([]);
      expect(miss.pagination.total).toBe(0);

      const { items: classes } = await repo.listClasses({ limit: 1 });
      const classHit = await repo.listClasses({
        q: classes[0].name,
        limit: 200,
      });
      expect(classHit.items.some((c) => c.slug === classes[0].slug)).toBe(
        true,
      );

      const { items: ingredients } = await repo.listIngredients({ limit: 1 });
      const ingHit = await repo.listIngredients({
        q: ingredients[0].name,
        limit: 200,
      });
      expect(ingHit.items.some((i) => i.slug === ingredients[0].slug)).toBe(
        true,
      );

      const { items: reactions } = await repo.listReactions({ limit: 1 });
      const reactionHit = await repo.listReactions({
        q: reactions[0].name,
        limit: 200,
      });
      expect(
        reactionHit.items.some((r) => r.slug === reactions[0].slug),
      ).toBe(true);
    });

    it("listDrugs jurisdiction filter scopes by regulatory agency", async () => {
      const all = await repo.listDrugs({ limit: 1 });
      // v0 dataset is US-FDA only: the filter must be a no-op for
      // US-FDA and an empty set for any other jurisdiction.
      const us = await repo.listDrugs({ jurisdiction: "US-FDA", limit: 1 });
      expect(us.pagination.total).toBe(all.pagination.total);
      const ema = await repo.listDrugs({ jurisdiction: "EU-EMA", limit: 1 });
      expect(ema.items).toEqual([]);
      expect(ema.pagination.total).toBe(0);
    });

    it("list q filter is case-insensitive and trims whitespace", async () => {
      const { items } = await repo.listDrugs({ limit: 1 });
      const upper = await repo.listDrugs({
        q: `  ${items[0].name.toUpperCase()}  `,
        limit: 200,
      });
      expect(upper.items.some((d) => d.slug === items[0].slug)).toBe(true);
    });

    it("listDrugs classSlug filter returns only members of that class", async () => {
      const { items } = await repo.listDrugs({ limit: 50 });
      const withClass = items.find((d) => d.classes.length > 0);
      expect(withClass).toBeDefined();
      const classSlug = withClass!.classes[0].slug;

      const filtered = await repo.listDrugs({ classSlug, limit: 200 });
      expect(filtered.items.length).toBeGreaterThan(0);
      for (const d of filtered.items) {
        expect(d.classes.some((c) => c.slug === classSlug)).toBe(true);
      }
      expect(filtered.items.some((d) => d.slug === withClass!.slug)).toBe(
        true,
      );
    });

    it("listClasses / getClass round-trip", async () => {
      const { items } = await repo.listClasses({ limit: 1 });
      expect(items.length).toBe(1);
      DrugClassSchema.parse(items[0]);
      const cls = await repo.getClass(items[0].slug);
      expect(cls?.slug).toBe(items[0].slug);
      expect(await repo.getClass("not-a-class")).toBeNull();
    });

    it("listIngredients / getIngredient round-trip", async () => {
      const { items } = await repo.listIngredients({ limit: 1 });
      expect(items.length).toBe(1);
      IngredientSchema.parse(items[0]);
      const ing = await repo.getIngredient(items[0].slug);
      expect(ing?.slug).toBe(items[0].slug);
      expect(await repo.getIngredient("not-an-ingredient")).toBeNull();
    });

    it("search finds a drug by its exact name", async () => {
      const { items } = await repo.listDrugs({ limit: 1 });
      const results = await repo.search(items[0].name, 10);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) SearchResultSchema.parse(r);
      expect(results.some((r) => r.slug === items[0].slug)).toBe(true);
    });

    it("search returns [] for blank queries and respects the limit", async () => {
      expect(await repo.search("   ", 10)).toEqual([]);
      const results = await repo.search("a", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("searchPassages reports its method and returns ranked, bounded results", async () => {
      const { items } = await repo.listDrugs({ limit: 1 });
      const { method, results } = await repo.searchPassages(items[0].name, {
        limit: 5,
      });
      expect(["embedding", "lexical"]).toContain(method);
      expect(results.length).toBeLessThanOrEqual(5);
      const scores = results.map((r) => r.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
      for (const r of results) {
        expect(r.id).toContain("#");
        expect(r.drug.slug).toBeTruthy();
        expect(r.provenance.sourceUrl).toBeTruthy();
      }
    });

    it("checkInteractions sorts+dedupes input and zero-fills the summary", async () => {
      const { items } = await repo.listDrugs({ limit: 2 });
      const [a, b] = items.map((d) => d.slug);
      const result = await repo.checkInteractions([b, a, b]);
      expect(result.input).toEqual([a, b].sort());
      expect(Object.keys(result.summary).sort()).toEqual(
        ["contraindicated", "major", "minor", "moderate", "unknown"].sort(),
      );
      const pairCount = result.pairs.length;
      const summed = Object.values(result.summary).reduce(
        (acc, n) => acc + n,
        0,
      );
      expect(summed).toBe(pairCount);
    });

    it("listBrands returns a sorted crosswalk", async () => {
      const brands = await repo.listBrands();
      expect(brands.length).toBeGreaterThan(0);
      const names = brands.map((b) => b.brand);
      expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
      for (const entry of brands.slice(0, 5)) {
        expect(entry.drugs.length).toBeGreaterThan(0);
      }
    });

    it("getAtcTree roots are level-1 letters with rolled-up counts", async () => {
      const tree = await repo.getAtcTree();
      expect(tree.length).toBeGreaterThan(0);
      for (const root of tree) {
        expect(root.level).toBe(1);
        expect(root.code).toMatch(/^[A-Z]$/);
        expect(root.drugCount).toBeGreaterThan(0);
      }
    });

    it("getMechanismGraph node degrees are consistent with links", async () => {
      const graph = await repo.getMechanismGraph();
      expect(graph.nodes.length).toBeGreaterThan(0);
      const degrees = new Map<string, number>();
      for (const link of graph.links) {
        degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1);
        degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1);
      }
      for (const node of graph.nodes) {
        expect(node.degree).toBe(degrees.get(node.id) ?? 0);
      }
    });

    it("reactions: list, resolve, and alias redirect agree", async () => {
      const { items } = await repo.listReactions({ limit: 5 });
      expect(items.length).toBeGreaterThan(0);

      const summary = items[0];
      const resolved = await repo.resolveReactionSlug(summary.slug);
      expect(resolved).toEqual({
        canonical: summary.slug,
        matched: summary.slug,
      });

      const reaction = await repo.getReaction(summary.slug);
      expect(reaction?.slug).toBe(summary.slug);

      expect(await repo.resolveReactionSlug("not-a-reaction")).toBeNull();
      expect(await repo.getReaction("not-a-reaction")).toBeNull();
    });

    it("listChangelog returns entries newest-first and honours limit", async () => {
      const entries = await repo.listChangelog({ limit: 5 });
      expect(entries.length).toBeLessThanOrEqual(5);
      const stamps = entries.map((e) => Date.parse(e.timestamp));
      expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
    });
  });
}

repositoryContract("StaticRepository", async () => {
  // setup.ts deletes DATABASE_URL, so this resolves to the seed backend.
  const { getRepository, getRepositoryKind } = await import(
    "@/lib/data/repository"
  );
  expect(getRepositoryKind()).toBe("static");
  return getRepository();
});

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) {
  repositoryContract("PrismaRepository", async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { PrismaRepository } = await import("@/lib/data/prisma-repository");
    return new PrismaRepository();
  });
}
