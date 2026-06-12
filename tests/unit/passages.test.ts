import { describe, expect, it } from "vitest";
import {
  buildDrugPassages,
  buildLexicalPassageIndex,
  buildPassages,
  hashPassageText,
  searchLexicalPassageIndex,
} from "@/lib/data/passages";
import { makeDrug } from "../helpers/fixtures";

describe("buildDrugPassages", () => {
  it("always emits an overview passage", () => {
    const drug = makeDrug({ slug: "test-drug", name: "Test Drug" });
    const passages = buildDrugPassages(drug);
    expect(passages.length).toBeGreaterThanOrEqual(1);
    expect(passages[0]).toMatchObject({
      id: "test-drug#overview",
      drugSlug: "test-drug",
      section: "overview",
      chunk: 0,
    });
    expect(passages[0].text).toContain("Test Drug");
  });

  it("emits one passage per populated section with stable ids", () => {
    const drug = makeDrug({
      slug: "rich-drug",
      name: "Rich Drug",
      mechanism: { summary: "Inhibits the thing.", targets: ["COX-1"] },
      indications: [{ text: "Treats headaches.", icd10: [], snomed: [] }],
      interactionsNarrative: "Avoid combining with other things.",
    });
    const passages = buildDrugPassages(drug);
    const ids = passages.map((p) => p.id);
    expect(ids).toContain("rich-drug#overview");
    expect(ids).toContain("rich-drug#mechanism");
    expect(ids).toContain("rich-drug#indications");
    expect(ids).toContain("rich-drug#interactions");

    const mechanism = passages.find((p) => p.section === "mechanism");
    expect(mechanism?.text).toContain("Molecular targets: COX-1.");
  });

  it("chunks long narratives at sentence boundaries with :n id suffixes", () => {
    // ~40 sentences of ~80 chars each → > 1400-char cap → multiple chunks.
    const sentence =
      "This is a deliberately verbose sentence about the pharmacology of the compound.";
    const drug = makeDrug({
      slug: "long-drug",
      name: "Long Drug",
      interactionsNarrative: Array(40).fill(sentence).join(" "),
    });
    const chunks = buildDrugPassages(drug).filter(
      (p) => p.section === "interactions",
    );
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((p, i) => {
      expect(p.id).toBe(`long-drug#interactions:${i}`);
      expect(p.chunk).toBe(i);
      expect(p.text.length).toBeLessThanOrEqual(1400);
      // Sentence-boundary splitting: chunks should end on punctuation.
      expect(p.text).toMatch(/[.!?]$/);
    });
  });

  it("collapses whitespace and skips empty sections", () => {
    const drug = makeDrug({
      slug: "ws-drug",
      name: "WS Drug",
      interactionsNarrative: "  Multiple   spaces\n\nand newlines.  ",
    });
    const interactions = buildDrugPassages(drug).find(
      (p) => p.section === "interactions",
    );
    expect(interactions?.text).toBe("Multiple spaces and newlines.");
  });

  it("hashes text deterministically (the re-embedding delta key)", () => {
    expect(hashPassageText("abc")).toBe(hashPassageText("abc"));
    expect(hashPassageText("abc")).not.toBe(hashPassageText("abd"));
    const drug = makeDrug({ slug: "h-drug", name: "H Drug" });
    const [a] = buildDrugPassages(drug);
    const [b] = buildDrugPassages(drug);
    expect(a.textHash).toBe(b.textHash);
    expect(a.textHash).toBe(hashPassageText(a.text));
  });

  it("carries the record provenance onto every passage", () => {
    const drug = makeDrug({
      slug: "p-drug",
      name: "P Drug",
      mechanism: { summary: "Does things.", targets: [] },
    });
    for (const p of buildDrugPassages(drug)) {
      expect(p.provenance).toEqual(drug.provenance);
    }
  });
});

describe("lexical passage index", () => {
  const drugs = [
    makeDrug({
      slug: "metformin-like",
      name: "Metformin-like",
      mechanism: {
        summary:
          "Decreases hepatic glucose production and improves insulin sensitivity.",
        targets: ["AMPK"],
      },
    }),
    makeDrug({
      slug: "statin-like",
      name: "Statin-like",
      mechanism: {
        summary: "Inhibits HMG-CoA reductase lowering cholesterol synthesis.",
        targets: ["HMG-CoA reductase"],
      },
    }),
  ];
  const index = buildLexicalPassageIndex(buildPassages(drugs));

  it("ranks the on-topic passage first and normalises scores to 0..1", () => {
    const results = searchLexicalPassageIndex(index, "glucose insulin", {
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].passage.drugSlug).toBe("metformin-like");
    expect(results[0].score).toBe(1);
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    // Descending order.
    const scores = results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("returns nothing for an empty or unmatched query", () => {
    expect(searchLexicalPassageIndex(index, "", { limit: 5 })).toEqual([]);
    expect(
      searchLexicalPassageIndex(index, "zzzzz qqqqq", { limit: 5 }),
    ).toEqual([]);
  });

  it("respects the section filter", () => {
    const results = searchLexicalPassageIndex(index, "cholesterol", {
      limit: 5,
      sections: ["overview"],
    });
    for (const r of results) {
      expect(r.passage.section).toBe("overview");
    }
  });

  it("respects the limit", () => {
    const results = searchLexicalPassageIndex(index, "drug", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
