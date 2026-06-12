import { describe, expect, it } from "vitest";

import {
  applyControlledSubstanceCrosswalk,
  controlledSubstanceForNames,
} from "@/lib/ingest/controlled-substances";
import { ControlledSubstanceSchema, type Drug } from "@/lib/schemas";

describe("controlledSubstanceForNames", () => {
  it("classifies known scheduled ingredients", () => {
    expect(controlledSubstanceForNames(["Oxycodone"])?.schedule).toBe("II");
    expect(controlledSubstanceForNames(["Alprazolam"])?.schedule).toBe("IV");
    expect(controlledSubstanceForNames(["Pregabalin"])?.schedule).toBe("V");
    expect(controlledSubstanceForNames(["Buprenorphine"])?.schedule).toBe(
      "III",
    );
  });

  it("returns null for non-scheduled ingredients", () => {
    expect(controlledSubstanceForNames(["Metformin"])).toBeNull();
    expect(controlledSubstanceForNames(["Atorvastatin", "Lisinopril"])).toBeNull();
  });

  it("flags narcotics and emits a schema-valid record", () => {
    const cs = controlledSubstanceForNames(["Fentanyl"]);
    expect(cs?.narcotic).toBe(true);
    ControlledSubstanceSchema.parse(cs);
  });

  it("picks the most restrictive schedule when several match", () => {
    // A IV benzodiazepine + a II opioid → the II wins.
    expect(
      controlledSubstanceForNames(["alprazolam", "oxycodone"])?.schedule,
    ).toBe("II");
  });

  it("matches on word boundaries, not substrings", () => {
    // "codeine" is CII, but a random word containing it must not match.
    expect(controlledSubstanceForNames(["encodeiner"])).toBeNull();
  });
});

describe("applyControlledSubstanceCrosswalk", () => {
  const base: Drug = {
    slug: "oxycodone",
    name: "Oxycodone",
    synonyms: [],
    jurisdiction: "US-FDA",
    ingredients: [{ slug: "oxycodone", name: "Oxycodone" }],
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

  it("fills an empty controlledSubstance", () => {
    const out = applyControlledSubstanceCrosswalk(base);
    expect(out.controlledSubstance?.schedule).toBe("II");
    expect(out).not.toBe(base);
  });

  it("never overwrites an existing value (fill-only, idempotent)", () => {
    const pre: Drug = {
      ...base,
      controlledSubstance: { schedule: "V", description: "preset" },
    };
    const out = applyControlledSubstanceCrosswalk(pre);
    expect(out).toBe(pre);
    expect(out.controlledSubstance?.schedule).toBe("V");
  });
});
