import { describe, expect, it } from "vitest";
import { GET as getDrug } from "@/app/api/v1/drug/[slug]/route";
import { GET as getDrugHistory } from "@/app/api/v1/drug/[slug]/history/route";
import { getRepository } from "@/lib/data/repository";
import { ApiErrorSchema, DrugHistoryResponseSchema } from "@/lib/schemas";

const BASE = "http://localhost/api/v1";
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function firstDrugSlug(): Promise<string> {
  const { items } = await getRepository().listDrugs({ limit: 1 });
  return items[0].slug;
}

describe("GET /api/v1/drug/[slug]/history", () => {
  it("returns a schema-valid history envelope with caching headers", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrugHistory(
      new Request(`${BASE}/drug/${slug}/history`),
      params(slug),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    const body = DrugHistoryResponseSchema.parse(await res.json());
    expect(body.drug.slug).toBe(slug);
    expect(body.total).toBe(body.events.length);
    expect(body.provenance.extractedAt).toBeTruthy();
  });

  it("echoes asOf and only keeps events at or before it", async () => {
    const slug = await firstDrugSlug();
    const asOf = "2026-01-01T00:00:00.000Z";
    const res = await getDrugHistory(
      new Request(`${BASE}/drug/${slug}/history?asOf=${asOf}`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = DrugHistoryResponseSchema.parse(await res.json());
    expect(body.asOf).toBe(asOf);
    for (const e of body.events) {
      expect(Date.parse(e.timestamp)).toBeLessThanOrEqual(Date.parse(asOf));
    }
  });

  it("400s on a malformed asOf", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrugHistory(
      new Request(`${BASE}/drug/${slug}/history?asOf=not-a-date`),
      params(slug),
    );
    expect(res.status).toBe(400);
    ApiErrorSchema.parse(await res.json());
  });

  it("404s for an unknown slug", async () => {
    const res = await getDrugHistory(
      new Request(`${BASE}/drug/nope/history`),
      params("nope"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/drug/[slug] with ?asOf=", () => {
  it("404s when the record was extracted after the asOf instant", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrug(
      new Request(`${BASE}/drug/${slug}?asOf=2000-01-01T00:00:00.000Z`),
      params(slug),
    );
    expect(res.status).toBe(404);
    ApiErrorSchema.parse(await res.json());
  });

  it("serves the record when asOf is after its extraction", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrug(
      new Request(`${BASE}/drug/${slug}?asOf=2099-01-01T00:00:00.000Z`),
      params(slug),
    );
    expect(res.status).toBe(200);
  });

  it("400s on a malformed asOf", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrug(
      new Request(`${BASE}/drug/${slug}?asOf=garbage`),
      params(slug),
    );
    expect(res.status).toBe(400);
  });
});
