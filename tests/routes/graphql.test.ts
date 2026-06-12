import { describe, expect, it } from "vitest";

import { POST as graphqlPost } from "@/app/api/graphql/route";
import { getRepository } from "@/lib/data/repository";

/**
 * GraphQL is a thin field-selection layer over the same
 * `PharmacopeiaRepository` the REST API uses. These tests drive the
 * real /api/graphql route handler (so the assertions exercise the
 * deployed surface, and yoga's own bundled graphql executes the query)
 * and check that the GraphQL surface returns the same data the
 * repository does — the two read surfaces must never diverge.
 */

interface GraphQLResult {
  data?: Record<string, unknown> | null;
  errors?: { message: string }[];
}

async function exec(
  source: string,
  variableValues?: Record<string, unknown>,
): Promise<GraphQLResult> {
  const res = await graphqlPost(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: source, variables: variableValues }),
    }),
  );
  return (await res.json()) as GraphQLResult;
}

async function firstDrugSlug(): Promise<string> {
  const { items } = await getRepository().listDrugs({ limit: 1 });
  return items[0].slug;
}

describe("GraphQL: stats", () => {
  it("matches the repository's stats", async () => {
    const repoStats = await getRepository().getStats();
    const res = await exec(`{ stats { drugs classes ingredients version } }`);
    expect(res.errors).toBeUndefined();
    const stats = (res.data as { stats: Record<string, unknown> }).stats;
    expect(stats.drugs).toBe(repoStats.drugs);
    expect(stats.classes).toBe(repoStats.classes);
    expect(stats.ingredients).toBe(repoStats.ingredients);
    expect(stats.version).toBe(repoStats.version);
  });
});

describe("GraphQL: drug", () => {
  it("resolves a drug with lazily-upgraded full fields", async () => {
    const slug = await firstDrugSlug();
    const repoDrug = await getRepository().getDrug(slug);
    const res = await exec(
      `query ($slug: ID!) {
        drug(slug: $slug) {
          slug
          name
          jurisdiction
          identifiers { rxcui atc }
          provenance { sourceUrl extractor }
        }
      }`,
      { slug },
    );
    expect(res.errors).toBeUndefined();
    const drug = (res.data as { drug: Record<string, unknown> }).drug;
    expect(drug.slug).toBe(slug);
    expect(drug.name).toBe(repoDrug!.name);
    // Enum is re-mapped to the GraphQL form (US_FDA), value-mapped back.
    expect(drug.jurisdiction).toBe("US_FDA");
  });

  it("returns null for an unknown slug", async () => {
    const res = await exec(`{ drug(slug: "not-a-drug") { slug } }`);
    expect(res.errors).toBeUndefined();
    expect((res.data as { drug: unknown }).drug).toBeNull();
  });

  it("resolves interactions parity with the repository", async () => {
    const slug = await firstDrugSlug();
    const repoInteractions = await getRepository().getDrugInteractions(slug);
    const res = await exec(
      `query ($slug: ID!) {
        drug(slug: $slug) { interactions { drugA drugB severity } }
      }`,
      { slug },
    );
    expect(res.errors).toBeUndefined();
    const interactions = (
      res.data as { drug: { interactions: unknown[] } }
    ).drug.interactions;
    expect(interactions.length).toBe(repoInteractions.length);
  });
});

describe("GraphQL: drugs pagination", () => {
  it("mirrors repository pagination", async () => {
    const repoList = await getRepository().listDrugs({ limit: 3, offset: 1 });
    const res = await exec(
      `{
        drugs(limit: 3, offset: 1) {
          items { slug }
          pagination { total limit offset }
        }
      }`,
    );
    expect(res.errors).toBeUndefined();
    const data = res.data as {
      drugs: { items: { slug: string }[]; pagination: { total: number; limit: number; offset: number } };
    };
    expect(data.drugs.items.map((d) => d.slug)).toEqual(
      repoList.items.map((d) => d.slug),
    );
    expect(data.drugs.pagination.total).toBe(repoList.pagination.total);
    expect(data.drugs.pagination.limit).toBe(3);
    expect(data.drugs.pagination.offset).toBe(1);
  });
});

describe("GraphQL: search + checkInteractions", () => {
  it("search matches repository search", async () => {
    const slug = await firstDrugSlug();
    const drug = await getRepository().getDrug(slug);
    const repoResults = await getRepository().search(drug!.name, 10);
    const res = await exec(
      `query ($q: String!) { search(q: $q, limit: 10) { slug kind } }`,
      { q: drug!.name },
    );
    expect(res.errors).toBeUndefined();
    const results = (res.data as { search: unknown[] }).search;
    expect(results.length).toBe(repoResults.length);
  });

  it("checkInteractions returns a summary roll-up", async () => {
    const { items } = await getRepository().listDrugs({ limit: 3 });
    const slugs = items.map((d) => d.slug);
    const res = await exec(
      `query ($drugs: [ID!]!) {
        checkInteractions(drugs: $drugs) {
          input
          summary { contraindicated major moderate minor unknown }
        }
      }`,
      { drugs: slugs },
    );
    expect(res.errors).toBeUndefined();
    const data = res.data as {
      checkInteractions: { input: string[]; summary: Record<string, number> };
    };
    expect(data.checkInteractions.input).toEqual(slugs);
    expect(typeof data.checkInteractions.summary.major).toBe("number");
  });
});

describe("GraphQL: structureSearch", () => {
  it("ranks matches for a valid SMILES", async () => {
    const res = await exec(
      `{
        structureSearch(smiles: "CCO", limit: 3) {
          method
          total
          results { slug score }
        }
      }`,
    );
    expect(res.errors).toBeUndefined();
    const data = res.data as {
      structureSearch: { method: string; results: unknown[] };
    };
    expect(data.structureSearch.method).toBe("tanimoto-2d-fingerprint");
  });

  it("surfaces an invalid SMILES as a GraphQL error", async () => {
    const res = await exec(
      `{ structureSearch(smiles: "   ") { method } }`,
    );
    expect(res.errors).toBeDefined();
    expect(res.errors!.length).toBeGreaterThan(0);
  });
});
