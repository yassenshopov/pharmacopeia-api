import { describe, expect, it } from "vitest";
import { GET as getDrug } from "@/app/api/v1/drug/[slug]/route";
import {
  GET as getDrugsBatchInfo,
  POST as postDrugsBatch,
} from "@/app/api/v1/drugs/batch/route";
import { GET as getDrugs } from "@/app/api/v1/drugs/route";
import { GET as getHealth } from "@/app/api/v1/health/route";
import {
  GET as getInteractionsCheckInfo,
  POST as postInteractionsCheck,
} from "@/app/api/v1/interactions/check/route";
import { GET as getSearch } from "@/app/api/v1/search/route";
import { getRepository } from "@/lib/data/repository";
import {
  ApiErrorSchema,
  DrugSchema,
  DrugsBatchResponseSchema,
  HealthResponseSchema,
  InteractionCheckResponseSchema,
  SearchResponseSchema,
} from "@/lib/schemas";

/**
 * Route-handler tests over the static seed backend. Handlers are
 * invoked directly with real Request objects — no server, no mocks —
 * so what's asserted here is exactly what a consumer sees: status
 * codes, headers, and schema-valid bodies.
 */

const BASE = "http://localhost/api/v1";

async function firstDrugSlug(): Promise<string> {
  const { items } = await getRepository().listDrugs({ limit: 1 });
  return items[0].slug;
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/v1/drug/[slug]", () => {
  it("returns a schema-valid drug with caching headers", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrug(
      new Request(`${BASE}/drug/${slug}`),
      params(slug),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("ETag")).toBeTruthy();
    const drug = DrugSchema.parse(await res.json());
    expect(drug.slug).toBe(slug);
  });

  it("404s with a schema-valid error envelope for unknown slugs", async () => {
    const res = await getDrug(
      new Request(`${BASE}/drug/not-a-drug`),
      params("not-a-drug"),
    );
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });

  it("serves 304 on a matching If-None-Match revalidation", async () => {
    const slug = await firstDrugSlug();
    const first = await getDrug(
      new Request(`${BASE}/drug/${slug}`),
      params(slug),
    );
    const etag = first.headers.get("ETag")!;
    const second = await getDrug(
      new Request(`${BASE}/drug/${slug}`, {
        headers: { "If-None-Match": etag },
      }),
      params(slug),
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("?fields= strips un-requested sections but stays schema-valid", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrug(
      new Request(`${BASE}/drug/${slug}?fields=mechanism`),
      params(slug),
    );
    const drug = DrugSchema.parse(await res.json());
    expect(drug.indications).toEqual([]);
    expect(drug.dosing).toEqual([]);
    expect(drug.labelSections).toBeUndefined();
    // Identity fields always survive.
    expect(drug.identifiers).toBeDefined();
    expect(drug.provenance).toBeDefined();
  });
});

describe("GET /api/v1/drugs", () => {
  it("paginates with clamped limits", async () => {
    const res = await getDrugs(new Request(`${BASE}/drugs?limit=2&offset=1`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.pagination).toMatchObject({ limit: 2, offset: 1 });

    const clamped = await getDrugs(new Request(`${BASE}/drugs?limit=9999`));
    const clampedBody = await clamped.json();
    expect(clampedBody.pagination.limit).toBe(200);
  });

  it("filters by class slug", async () => {
    const { items } = await getRepository().listDrugs({ limit: 50 });
    const withClass = items.find((d) => d.classes.length > 0)!;
    const classSlug = withClass.classes[0].slug;
    const res = await getDrugs(
      new Request(`${BASE}/drugs?class=${classSlug}&limit=200`),
    );
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const d of body.items) {
      expect(
        d.classes.some((c: { slug: string }) => c.slug === classSlug),
      ).toBe(true);
    }
  });

  it("filters by jurisdiction and rejects unknown values", async () => {
    const us = await getDrugs(
      new Request(`${BASE}/drugs?jurisdiction=US-FDA&limit=1`),
    );
    expect(us.status).toBe(200);
    const usBody = await us.json();
    expect(usBody.pagination.total).toBeGreaterThan(0);

    const ema = await getDrugs(
      new Request(`${BASE}/drugs?jurisdiction=EU-EMA&limit=1`),
    );
    const emaBody = await ema.json();
    expect(emaBody.items).toEqual([]);

    const bad = await getDrugs(
      new Request(`${BASE}/drugs?jurisdiction=XX-NOPE`),
    );
    expect(bad.status).toBe(400);
    const badBody = await bad.json();
    expect(badBody.error.code).toBe("invalid_request");
  });
});

describe("POST /api/v1/drugs/batch", () => {
  const post = (body: unknown) =>
    postDrugsBatch(
      new Request(`${BASE}/drugs/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  it("resolves slugs, collapses duplicates, and reports missing", async () => {
    const slug = await firstDrugSlug();
    const res = await post({ slugs: [slug, slug, "nope-drug"] });
    expect(res.status).toBe(200);
    const body = DrugsBatchResponseSchema.parse(await res.json());
    expect(body.found.map((d) => d.slug)).toEqual([slug]);
    expect(body.missing).toEqual(["nope-drug"]);
    expect(body.total).toBe(1);
  });

  it("rejects malformed JSON, bad shapes, and over-limit requests", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ slugs: [] })).status).toBe(400);
    expect((await post({ slugs: ["UPPER-CASE"] })).status).toBe(400);
    expect(
      (await post({ slugs: Array(101).fill("metformin") })).status,
    ).toBe(400);
  });

  it("GET responds with usage guidance, not a payload", async () => {
    const res = await getDrugsBatchInfo();
    expect(res.status).toBe(400);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.message).toContain("POST");
  });
});

describe("GET /api/v1/search", () => {
  it("requires a query", async () => {
    const res = await getSearch(new Request(`${BASE}/search`));
    expect(res.status).toBe(400);
  });

  it("returns schema-valid results for a known drug name", async () => {
    const { items } = await getRepository().listDrugs({ limit: 1 });
    const res = await getSearch(
      new Request(`${BASE}/search?q=${encodeURIComponent(items[0].name)}`),
    );
    expect(res.status).toBe(200);
    const body = SearchResponseSchema.parse(await res.json());
    expect(body.total).toBe(body.results.length);
    expect(body.results.some((r) => r.slug === items[0].slug)).toBe(true);
  });
});

describe("POST /api/v1/interactions/check", () => {
  it("checks a pair and returns a schema-valid envelope", async () => {
    const { items } = await getRepository().listDrugs({ limit: 2 });
    const slugs = items.map((d) => d.slug);
    const res = await postInteractionsCheck(
      new Request(`${BASE}/interactions/check`, {
        method: "POST",
        body: JSON.stringify({ drugs: slugs }),
      }),
    );
    expect(res.status).toBe(200);
    const body = InteractionCheckResponseSchema.parse(await res.json());
    expect(body.input).toEqual([...slugs].sort());
  });

  it("rejects fewer than two drugs", async () => {
    const res = await postInteractionsCheck(
      new Request(`${BASE}/interactions/check`, {
        method: "POST",
        body: JSON.stringify({ drugs: ["metformin"] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET responds with usage guidance", async () => {
    const res = await getInteractionsCheckInfo();
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/health", () => {
  it("reports ok on the static backend with a short cache window", async () => {
    const res = await getHealth(new Request(`${BASE}/health`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=60");
    const body = HealthResponseSchema.parse(await res.json());
    expect(body.status).toBe("ok");
    expect(body.repository).toBe("static");
  });
});
