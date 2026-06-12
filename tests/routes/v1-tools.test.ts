import { describe, expect, it } from "vitest";

import {
  GET as getStructureSearch,
  POST as postStructureSearch,
} from "@/app/api/v1/structure-search/route";
import { GET as getSemanticSearch } from "@/app/api/v1/semantic-search/route";
import { GET as getSimilar } from "@/app/api/v1/drug/[slug]/similar/route";
import { GET as getShortages } from "@/app/api/v1/shortages/route";
import { GET as getDrugShortages } from "@/app/api/v1/drug/[slug]/shortages/route";
import { GET as getChangelog } from "@/app/api/v1/changelog/route";
import { GET as getReactions } from "@/app/api/v1/reactions/route";
import { GET as getReaction } from "@/app/api/v1/reaction/[slug]/route";
import { getRepository } from "@/lib/data/repository";
import {
  ApiErrorSchema,
  ChangelogResponseSchema,
  DrugShortagesResponseSchema,
  ReactionResponseSchema,
  ReactionsListResponseSchema,
  SemanticSearchResponseSchema,
  ShortagesResponseSchema,
  SimilarDrugsResponseSchema,
  StructureSearchResponseSchema,
} from "@/lib/schemas";

const BASE = "http://localhost/api/v1";
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function firstDrugSlug(): Promise<string> {
  const { items } = await getRepository().listDrugs({ limit: 1 });
  return items[0].slug;
}

describe("structure-search /api/v1/structure-search", () => {
  it("ranks matches for a valid SMILES (GET)", async () => {
    const res = await getStructureSearch(
      new Request(`${BASE}/structure-search?smiles=CCO&limit=5`),
    );
    expect(res.status).toBe(200);
    const body = StructureSearchResponseSchema.parse(await res.json());
    expect(body.method).toBe("tanimoto-2d-fingerprint");
    expect(body.results.length).toBeLessThanOrEqual(5);
    // Results are sorted by descending score.
    const scores = body.results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("accepts a SMILES via POST body", async () => {
    const res = await postStructureSearch(
      new Request(`${BASE}/structure-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: "CCO", limit: 3 }),
      }),
    );
    expect(res.status).toBe(200);
    StructureSearchResponseSchema.parse(await res.json());
  });

  it("400s when smiles is missing (GET)", async () => {
    const res = await getStructureSearch(
      new Request(`${BASE}/structure-search`),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("400s on a non-JSON POST body", async () => {
    const res = await postStructureSearch(
      new Request(`${BASE}/structure-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("semantic-search /api/v1/semantic-search", () => {
  it("returns a schema-valid result set (lexical fallback on static)", async () => {
    const res = await getSemanticSearch(
      new Request(`${BASE}/semantic-search?q=lowers%20blood%20pressure&limit=5`),
    );
    expect(res.status).toBe(200);
    const body = SemanticSearchResponseSchema.parse(await res.json());
    // No embeddings provider in tests → lexical fallback.
    expect(body.method).toBe("lexical");
    expect(body.results.length).toBeLessThanOrEqual(5);
    expect(body.disclaimer.length).toBeGreaterThan(0);
  });

  it("400s on too-short queries", async () => {
    const res = await getSemanticSearch(new Request(`${BASE}/semantic-search?q=ab`));
    expect(res.status).toBe(400);
  });

  it("400s on an invalid sections filter", async () => {
    const res = await getSemanticSearch(
      new Request(`${BASE}/semantic-search?q=blood&sections=not-a-section`),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/drug/[slug]/similar", () => {
  it("returns schema-valid structural analogs", async () => {
    const slug = await firstDrugSlug();
    const res = await getSimilar(
      new Request(`${BASE}/drug/${slug}/similar`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = SimilarDrugsResponseSchema.parse(await res.json());
    expect(body.drug.slug).toBe(slug);
    expect(body.total).toBe(body.similar.length);
  });

  it("404s for an unknown drug", async () => {
    const res = await getSimilar(
      new Request(`${BASE}/drug/nope/similar`),
      params("nope"),
    );
    expect(res.status).toBe(404);
    ApiErrorSchema.parse(await res.json());
  });
});

describe("GET /api/v1/shortages", () => {
  it("returns the flat shortage index with a short TTL", async () => {
    const res = await getShortages(new Request(`${BASE}/shortages`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=600");
    const body = ShortagesResponseSchema.parse(await res.json());
    expect(body.total).toBe(body.entries.length);
  });
});

describe("GET /api/v1/drug/[slug]/shortages", () => {
  it("returns a per-drug shortage envelope with anyActive roll-up", async () => {
    const slug = await firstDrugSlug();
    const res = await getDrugShortages(
      new Request(`${BASE}/drug/${slug}/shortages`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = DrugShortagesResponseSchema.parse(await res.json());
    expect(body.drug.slug).toBe(slug);
    expect(body.anyActive).toBe(
      body.entries.some((e) => e.status === "active"),
    );
  });

  it("404s for an unknown drug", async () => {
    const res = await getDrugShortages(
      new Request(`${BASE}/drug/nope/shortages`),
      params("nope"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/changelog", () => {
  it("returns schema-valid entries", async () => {
    const res = await getChangelog(new Request(`${BASE}/changelog?limit=5`));
    expect(res.status).toBe(200);
    const body = ChangelogResponseSchema.parse(await res.json());
    expect(body.total).toBe(body.entries.length);
  });

  it("400s on a malformed `since` timestamp", async () => {
    const res = await getChangelog(
      new Request(`${BASE}/changelog?since=not-a-date`),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });
});

describe("reactions /api/v1/reactions + /reaction/[slug]", () => {
  it("paginates schema-valid reaction summaries", async () => {
    const res = await getReactions(new Request(`${BASE}/reactions?limit=5`));
    expect(res.status).toBe(200);
    const body = ReactionsListResponseSchema.parse(await res.json());
    expect(body.items.length).toBeLessThanOrEqual(5);
  });

  it("returns a schema-valid reaction detail by slug", async () => {
    const { items } = await getRepository().listReactions({ limit: 1 });
    if (items.length === 0) return; // dataset without FAERS aggregates
    const slug = items[0].slug;
    const res = await getReaction(
      new Request(`${BASE}/reaction/${slug}`),
      params(slug),
    );
    expect(res.status).toBe(200);
    const body = ReactionResponseSchema.parse(await res.json());
    expect(body.slug).toBe(slug);
  });

  it("404s for an unknown reaction", async () => {
    const res = await getReaction(
      new Request(`${BASE}/reaction/not-a-reaction-xyz`),
      params("not-a-reaction-xyz"),
    );
    expect(res.status).toBe(404);
    ApiErrorSchema.parse(await res.json());
  });
});
