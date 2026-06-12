import { describe, expect, it } from "vitest";

import {
  buildReactionIndex,
  resolveReactionSlugInIndex,
  slugifyReactionName,
} from "@/lib/data/reactions-index";
import { ADVERSE_EVENT_DISCLAIMER, type AdverseEventStats } from "@/lib/schemas";
import { TEST_PROVENANCE } from "../helpers/fixtures";

function stats(
  drug: string,
  totalReports: number,
  reactions: [string, number][],
): AdverseEventStats {
  return {
    drug,
    totalReports,
    topReactions: reactions.map(([reaction, count]) => ({ reaction, count })),
    disclaimer: ADVERSE_EVENT_DISCLAIMER,
    provenance: TEST_PROVENANCE,
  };
}

describe("slugifyReactionName", () => {
  it("lower-kebabs free-form MedDRA terms", () => {
    expect(slugifyReactionName("Nausea")).toBe("nausea");
    expect(slugifyReactionName("Drug ineffective")).toBe("drug-ineffective");
    expect(slugifyReactionName("  Rash (generalised)  ")).toBe(
      "rash-generalised",
    );
  });
});

describe("buildReactionIndex", () => {
  const drugNames = new Map([
    ["metformin", "Metformin"],
    ["aspirin", "Aspirin"],
  ]);
  const index = buildReactionIndex({
    adverseEvents: [
      stats("metformin", 1000, [
        ["Nausea", 300],
        ["Diarrhoea", 200],
      ]),
      stats("aspirin", 500, [
        ["Nausea", 100],
        ["Haemorrhage", 50],
      ]),
    ],
    drugNames,
    getMeta: () => null,
  });

  it("merges a reaction reported by multiple drugs", () => {
    const nausea = index.reactions.get("nausea");
    expect(nausea).toBeDefined();
    expect(nausea!.totalReports).toBe(400);
    // Both reporting drugs are present, ordered by count desc.
    expect(nausea!.drugs.map((d) => d.drug)).toEqual(["metformin", "aspirin"]);
  });

  it("computes per-drug share against the drug's total reports", () => {
    const nausea = index.reactions.get("nausea")!;
    const metRow = nausea.drugs.find((d) => d.drug === "metformin")!;
    expect(metRow.share).toBeCloseTo(0.3, 5);
  });

  it("orders summaries by total reporting volume desc", () => {
    const totals = index.summaries.map((s) => s.totalReports);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("maps British spelling aliases to the canonical slug", () => {
    // "Diarrhoea" canonicalises to diarrhoea; its American alias
    // "diarrhea" must resolve back to the same record.
    const viaAlias = resolveReactionSlugInIndex(index, "diarrhea");
    const canonical = resolveReactionSlugInIndex(index, "diarrhoea");
    expect(canonical).not.toBeNull();
    expect(viaAlias?.canonical).toBe(canonical?.canonical);
  });

  it("returns null for an unknown reaction slug", () => {
    expect(resolveReactionSlugInIndex(index, "not-a-reaction")).toBeNull();
  });
});
