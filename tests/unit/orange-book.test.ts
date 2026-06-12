import { describe, expect, it } from "vitest";

import {
  applyOrangeBookCrosswalk,
  orangeBookForNames,
} from "@/lib/ingest/orange-book";
import { OrangeBookSchema, type Drug } from "@/lib/schemas";

describe("orangeBookForNames", () => {
  it("classifies a well-established AB-rated generic", () => {
    const ob = orangeBookForNames(["Metformin"]);
    expect(ob?.teCode).toBe("AB");
    expect(ob?.genericAvailable).toBe(true);
    OrangeBookSchema.parse(ob);
  });

  it("flags brand-dominant products with no AB generic", () => {
    const ob = orangeBookForNames(["Apixaban"]);
    expect(ob?.genericAvailable).toBe(false);
    expect(ob?.teCode).toBeUndefined();
    OrangeBookSchema.parse(ob);
  });

  it("returns null for an unlisted ingredient", () => {
    expect(orangeBookForNames(["Madeupazole"])).toBeNull();
  });

  it("matches on word boundaries, not substrings", () => {
    expect(orangeBookForNames(["premetformins"])).toBeNull();
  });
});

describe("applyOrangeBookCrosswalk", () => {
  const base: Drug = {
    slug: "metformin",
    name: "Metformin",
    synonyms: [],
    jurisdiction: "US-FDA",
    ingredients: [{ slug: "metformin", name: "Metformin" }],
    brands: [],
    classes: [],
    indications: [],
    contraindications: [],
    dosing: [],
    approvalHistory: [],
    identifiers: { ndc: [], atc: [] },
    provenance: {
      sourceUrl: "https://example.test",
      sourceHash: "x",
      extractedAt: "2026-01-01T00:00:00.000Z",
      extractor: "test",
      confidence: 1,
    },
  };

  it("fills an empty orangeBook", () => {
    const out = applyOrangeBookCrosswalk(base);
    expect(out.orangeBook?.teCode).toBe("AB");
    expect(out).not.toBe(base);
  });

  it("never overwrites an existing value (fill-only, idempotent)", () => {
    const pre: Drug = {
      ...base,
      orangeBook: { genericAvailable: false, description: "preset" },
    };
    const out = applyOrangeBookCrosswalk(pre);
    expect(out).toBe(pre);
    expect(out.orangeBook?.description).toBe("preset");
  });
});
