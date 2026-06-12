import { describe, expect, it } from "vitest";

import {
  buildStructureIndex,
  InvalidSmilesError,
  searchStructureIndex,
  type StructureIndexInput,
} from "@/lib/data/structure-search";

const ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O";
const ETHANOL = "CCO";
const CAFFEINE = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C";

const INPUTS: StructureIndexInput[] = [
  { slug: "aspirin", name: "Aspirin", smiles: ASPIRIN, className: "NSAID" },
  { slug: "ethanol", name: "Ethanol", smiles: ETHANOL, className: undefined },
  { slug: "caffeine", name: "Caffeine", smiles: CAFFEINE, className: "Stimulant" },
];

describe("buildStructureIndex", () => {
  it("fingerprints valid molecules and skips unparseable ones", () => {
    const index = buildStructureIndex([
      ...INPUTS,
      { slug: "garbage", name: "Garbage", smiles: "!!!nope!!!", className: undefined },
    ]);
    const slugs = index.map((e) => e.slug);
    expect(slugs).toContain("aspirin");
    expect(slugs).not.toContain("garbage");
  });
});

describe("searchStructureIndex", () => {
  const index = buildStructureIndex(INPUTS);

  it("ranks the exact query molecule first with score 1", () => {
    const results = searchStructureIndex(index, ASPIRIN, {
      limit: 10,
      threshold: 0,
    });
    expect(results[0].slug).toBe("aspirin");
    expect(results[0].score).toBe(1);
  });

  it("returns results sorted by descending score", () => {
    const results = searchStructureIndex(index, ASPIRIN, {
      limit: 10,
      threshold: 0,
    });
    const scores = results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("respects the limit", () => {
    const results = searchStructureIndex(index, ASPIRIN, {
      limit: 1,
      threshold: 0,
    });
    expect(results).toHaveLength(1);
  });

  it("filters out matches below the threshold", () => {
    const results = searchStructureIndex(index, ASPIRIN, {
      limit: 10,
      threshold: 0.99,
    });
    // Only the exact self-match clears a 0.99 bar.
    expect(results.every((r) => r.score >= 0.99)).toBe(true);
    expect(results[0].slug).toBe("aspirin");
  });

  it("rounds scores to three decimals", () => {
    const results = searchStructureIndex(index, CAFFEINE, {
      limit: 10,
      threshold: 0,
    });
    for (const r of results) {
      expect(Number(r.score.toFixed(3))).toBe(r.score);
    }
  });

  it("throws InvalidSmilesError on an empty query", () => {
    expect(() =>
      searchStructureIndex(index, "   ", { limit: 5, threshold: 0 }),
    ).toThrow(InvalidSmilesError);
  });

  it("throws InvalidSmilesError on an unparseable query", () => {
    expect(() =>
      searchStructureIndex(index, "!!!not-a-molecule!!!", {
        limit: 5,
        threshold: 0,
      }),
    ).toThrow(InvalidSmilesError);
  });
});
