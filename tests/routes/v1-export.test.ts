import { describe, expect, it } from "vitest";

import { GET as exportRoute } from "@/app/api/v1/export/route";
import { getRepository } from "@/lib/data/repository";
import { ApiErrorSchema, DrugSchema, IngredientSchema } from "@/lib/schemas";

/**
 * Bulk export surface. The index lists the available dumps; each dump
 * streams schema-valid NDJSON straight from the repository, so the
 * export can never drift from the per-record endpoints.
 */

const BASE = "http://localhost/api/v1";

function parseNdjson(text: string): unknown[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("GET /api/v1/export", () => {
  it("returns an index of available datasets with live counts", async () => {
    const res = await exportRoute(new Request(`${BASE}/export`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    const stats = await getRepository().getStats();
    const drugs = body.datasets.find(
      (d: { name: string }) => d.name === "drugs",
    );
    expect(drugs.records).toBe(stats.drugs);
    expect(drugs.url).toBe("/api/v1/export?dataset=drugs");
    expect(body.datasets.map((d: { name: string }) => d.name).sort()).toEqual([
      "classes",
      "drugs",
      "ingredients",
    ]);
  });

  it("streams every drug as schema-valid NDJSON", async () => {
    const res = await exportRoute(
      new Request(`${BASE}/export?dataset=drugs`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect(res.headers.get("Content-Disposition")).toContain(
      "pharmacopeia-drugs.ndjson",
    );
    const records = parseNdjson(await res.text());
    const stats = await getRepository().getStats();
    expect(records.length).toBe(stats.drugs);
    // Spot-check the head + tail parse as full Drug records.
    DrugSchema.parse(records[0]);
    DrugSchema.parse(records[records.length - 1]);
  });

  it("streams ingredients as schema-valid NDJSON", async () => {
    const res = await exportRoute(
      new Request(`${BASE}/export?dataset=ingredients`),
    );
    expect(res.status).toBe(200);
    const records = parseNdjson(await res.text());
    expect(records.length).toBeGreaterThan(0);
    IngredientSchema.parse(records[0]);
  });

  it("400s for an unknown dataset", async () => {
    const res = await exportRoute(
      new Request(`${BASE}/export?dataset=nope`),
    );
    expect(res.status).toBe(400);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_request");
  });
});
