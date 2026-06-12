import { describe, expect, it } from "vitest";

import {
  rankFuzzy,
  trigramSimilarity,
  trigrams,
  type FuzzyCandidate,
} from "@/lib/data/fuzzy-search";

describe("trigrams", () => {
  it("normalises case and punctuation before chunking", () => {
    expect(trigrams("ACE-inhibitor")).toEqual(trigrams("ace inhibitor"));
  });

  it("is empty for blank input", () => {
    expect(trigrams("   ").size).toBe(0);
  });
});

describe("trigramSimilarity", () => {
  it("scores identical strings at 1", () => {
    expect(trigramSimilarity("metformin", "metformin")).toBe(1);
  });

  it("scores disjoint strings at 0", () => {
    expect(trigramSimilarity("aspirin", "warfarin")).toBeLessThan(0.3);
  });

  it("scores a one-character typo highly", () => {
    expect(trigramSimilarity("metfornin", "metformin")).toBeGreaterThan(0.4);
  });

  it("is symmetric", () => {
    expect(trigramSimilarity("ibuprofen", "ibruprofen")).toBeCloseTo(
      trigramSimilarity("ibruprofen", "ibuprofen"),
    );
  });
});

describe("rankFuzzy", () => {
  const candidates: FuzzyCandidate[] = [
    { slug: "metformin", name: "Metformin", kind: "drug" },
    { slug: "metronidazole", name: "Metronidazole", kind: "drug" },
    { slug: "warfarin", name: "Warfarin", kind: "drug" },
    { slug: "biguanides", name: "Biguanides", kind: "class" },
  ];

  it("recovers the intended drug from a typo", () => {
    const results = rankFuzzy("metfornin", candidates, { limit: 5 });
    expect(results[0]?.slug).toBe("metformin");
  });

  it("returns name-only results without a description", () => {
    const [top] = rankFuzzy("metfornin", candidates, { limit: 1 });
    expect(top).toEqual({ slug: "metformin", name: "Metformin", kind: "drug" });
    expect("description" in (top ?? {})).toBe(false);
  });

  it("respects the limit", () => {
    expect(rankFuzzy("met", candidates, { limit: 1, threshold: 0 })).toHaveLength(
      1,
    );
  });

  it("returns nothing when no candidate clears the threshold", () => {
    expect(rankFuzzy("zzzzzzzz", candidates, { limit: 5 })).toEqual([]);
  });

  it("orders deterministically: score, then shorter name, then slug", () => {
    const tie: FuzzyCandidate[] = [
      { slug: "b-drug", name: "Abcdef", kind: "drug" },
      { slug: "a-drug", name: "Abcdef", kind: "drug" },
    ];
    const results = rankFuzzy("abcdef", tie, { limit: 2 });
    expect(results.map((r) => r.slug)).toEqual(["a-drug", "b-drug"]);
  });
});
