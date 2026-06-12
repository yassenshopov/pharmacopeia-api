import { describe, expect, it } from "vitest";

import { GET as getStats } from "@/app/api/v1/stats/route";
import { GET as getAtc } from "@/app/api/v1/atc/route";
import { GET as getBrands } from "@/app/api/v1/brands/route";
import { GET as getMechanismGraph } from "@/app/api/v1/mechanisms/graph/route";
import { GET as getClasses } from "@/app/api/v1/classes/route";
import { GET as getIngredients } from "@/app/api/v1/ingredients/route";
import { GET as getClass } from "@/app/api/v1/class/[slug]/route";
import { GET as getIngredient } from "@/app/api/v1/ingredient/[slug]/route";
import { getRepository } from "@/lib/data/repository";
import {
  ApiErrorSchema,
  BrandsResponseSchema,
  ClassDetailResponseSchema,
  ClassListResponseSchema,
  IngredientListResponseSchema,
  IngredientSchema,
  StatsSchema,
} from "@/lib/schemas";

/**
 * Route-handler coverage for the catalog + derived-view surface.
 * Handlers are invoked directly with real Request objects against the
 * static seed backend, so the assertions are exactly what a consumer
 * sees: status, cache headers, and schema-valid bodies.
 */

const BASE = "http://localhost/api/v1";
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/v1/stats", () => {
  it("returns schema-valid totals with a short CDN TTL", async () => {
    const res = await getStats(new Request(`${BASE}/stats`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
    const stats = StatsSchema.parse(await res.json());
    expect(stats.drugs).toBeGreaterThan(0);
    expect(stats.classes).toBeGreaterThan(0);
    expect(stats.ingredients).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/atc", () => {
  it("returns the nested WHO ATC tree with level/child invariants", async () => {
    const res = await getAtc(new Request(`${BASE}/atc`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.levels).toBe(5);
    expect(body.groups).toBe(body.tree.length);
    expect(Array.isArray(body.tree)).toBe(true);
    expect(body.tree.length).toBeGreaterThan(0);

    // Level-1 nodes carry level 1 and children; counts roll up.
    for (const l1 of body.tree) {
      expect(l1.level).toBe(1);
      expect(typeof l1.code).toBe("string");
      expect(l1.drugCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(l1.children)).toBe(true);
    }
  });
});

describe("GET /api/v1/brands", () => {
  it("returns the brand → generic crosswalk", async () => {
    const res = await getBrands(new Request(`${BASE}/brands`));
    expect(res.status).toBe(200);
    const body = BrandsResponseSchema.parse(await res.json());
    expect(body.total).toBe(body.brands.length);
    expect(body.brands.length).toBeGreaterThan(0);
    // Every brand resolves to at least one drug.
    for (const b of body.brands.slice(0, 20)) {
      expect(b.drugs.length).toBeGreaterThan(0);
    }
  });
});

describe("GET /api/v1/mechanisms/graph", () => {
  it("returns a tripartite node/link graph with consistent counts", async () => {
    const res = await getMechanismGraph(new Request(`${BASE}/mechanisms/graph`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.links)).toBe(true);
    expect(body.counts.links).toBe(body.links.length);
    const drugNodes = body.nodes.filter(
      (n: { type: string }) => n.type === "drug",
    );
    expect(body.counts.drug).toBe(drugNodes.length);
    // Every link references node ids that exist in the node set.
    const ids = new Set(body.nodes.map((n: { id: string }) => n.id));
    for (const link of body.links.slice(0, 50)) {
      expect(ids.has(link.source)).toBe(true);
      expect(ids.has(link.target)).toBe(true);
    }
  });
});

describe("GET /api/v1/classes", () => {
  it("paginates schema-valid classes and filters by q", async () => {
    const res = await getClasses(new Request(`${BASE}/classes?limit=5`));
    expect(res.status).toBe(200);
    const body = ClassListResponseSchema.parse(await res.json());
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.pagination.total).toBeGreaterThan(0);

    const name = body.items[0].name;
    const filtered = await getClasses(
      new Request(`${BASE}/classes?q=${encodeURIComponent(name)}&limit=200`),
    );
    const filteredBody = ClassListResponseSchema.parse(await filtered.json());
    expect(
      filteredBody.items.some((c) => c.slug === body.items[0].slug),
    ).toBe(true);
  });
});

describe("GET /api/v1/ingredients", () => {
  it("paginates schema-valid ingredients", async () => {
    const res = await getIngredients(new Request(`${BASE}/ingredients?limit=5`));
    expect(res.status).toBe(200);
    const body = IngredientListResponseSchema.parse(await res.json());
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.pagination.total).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/class/[slug]", () => {
  it("returns the class with its member drugs", async () => {
    const { items } = await getRepository().listClasses({ limit: 1 });
    const slug = items[0].slug;
    const res = await getClass(new Request(`${BASE}/class/${slug}`), params(slug));
    expect(res.status).toBe(200);
    const body = ClassDetailResponseSchema.parse(await res.json());
    expect(body.slug).toBe(slug);
    expect(Array.isArray(body.drugs)).toBe(true);
  });

  it("404s with a schema-valid envelope for an unknown class", async () => {
    const res = await getClass(
      new Request(`${BASE}/class/not-a-class`),
      params("not-a-class"),
    );
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });
});

describe("GET /api/v1/ingredient/[slug]", () => {
  it("returns a schema-valid ingredient", async () => {
    const { items } = await getRepository().listIngredients({ limit: 1 });
    const slug = items[0].slug;
    const res = await getIngredient(
      new Request(`${BASE}/ingredient/${slug}`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = IngredientSchema.parse(await res.json());
    expect(body.slug).toBe(slug);
  });

  it("404s for an unknown ingredient", async () => {
    const res = await getIngredient(
      new Request(`${BASE}/ingredient/nope-ingredient`),
      params("nope-ingredient"),
    );
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });
});
