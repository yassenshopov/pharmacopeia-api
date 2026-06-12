import { describe, expect, it } from "vitest";

import { GET as listConditions } from "@/app/api/v1/conditions/route";
import { GET as getCondition } from "@/app/api/v1/condition/[slug]/route";
import { getRepository } from "@/lib/data/repository";
import {
  ApiErrorSchema,
  ConditionResponseSchema,
  ConditionsListResponseSchema,
} from "@/lib/schemas";

/**
 * Route-handler coverage for the conditions reverse-index surface.
 * Invoked directly against the static seed backend, so the assertions
 * are exactly what a consumer sees: status, schema-valid bodies, and
 * the 404 envelope for unknown slugs.
 */

const BASE = "http://localhost/api/v1";
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/v1/conditions", () => {
  it("paginates schema-valid conditions and filters by q", async () => {
    const res = await listConditions(new Request(`${BASE}/conditions?limit=5`));
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
    const body = ConditionsListResponseSchema.parse(await res.json());
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.pagination.total).toBeGreaterThan(0);

    const name = body.items[0].name;
    const filtered = await listConditions(
      new Request(`${BASE}/conditions?q=${encodeURIComponent(name)}&limit=200`),
    );
    const filteredBody = ConditionsListResponseSchema.parse(
      await filtered.json(),
    );
    expect(
      filteredBody.items.some((c) => c.slug === body.items[0].slug),
    ).toBe(true);
  });
});

describe("GET /api/v1/condition/[slug]", () => {
  it("returns the condition with its labeled drugs", async () => {
    const { items } = await getRepository().listConditions({ limit: 1 });
    const slug = items[0].slug;
    const res = await getCondition(
      new Request(`${BASE}/condition/${slug}`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = ConditionResponseSchema.parse(await res.json());
    expect(body.slug).toBe(slug);
    expect(body.drugs.length).toBeGreaterThan(0);
    expect(body.disclaimer).toBeTruthy();
  });

  it("404s with a schema-valid envelope for an unknown condition", async () => {
    const res = await getCondition(
      new Request(`${BASE}/condition/not-a-condition`),
      params("not-a-condition"),
    );
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });
});
