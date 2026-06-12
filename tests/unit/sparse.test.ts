import { describe, expect, it } from "vitest";
import {
  applyDrugSparseFields,
  DRUG_SPARSE_SECTIONS,
  parseDrugFields,
} from "@/lib/api/sparse";
import { DrugSchema } from "@/lib/schemas";
import { makeDrug } from "../helpers/fixtures";

describe("parseDrugFields", () => {
  it("returns null when no filter is requested", () => {
    expect(parseDrugFields(null)).toBeNull();
  });

  it("returns an empty set for a blank value (filter to identity only)", () => {
    expect(parseDrugFields("")?.size).toBe(0);
    expect(parseDrugFields("  ")?.size).toBe(0);
  });

  it("parses comma-separated names, ignoring unknown and empty parts", () => {
    const fields = parseDrugFields("mechanism, bogus,,labelSections ,");
    expect(fields).toEqual(new Set(["mechanism", "labelSections"]));
  });

  it("recognises every documented section name", () => {
    const fields = parseDrugFields(DRUG_SPARSE_SECTIONS.join(","));
    expect(fields?.size).toBe(DRUG_SPARSE_SECTIONS.length);
  });
});

describe("applyDrugSparseFields", () => {
  const full = makeDrug({
    slug: "sparse-drug",
    name: "Sparse Drug",
    mechanism: { summary: "Inhibits things.", targets: ["X"] },
    indications: [{ text: "Treats things.", icd10: [], snomed: [] }],
    contraindications: [{ text: "Never with Y.", severity: "major" }],
    dosing: [{ route: "oral", population: "adult", dose: "10 mg" }],
    pharmacokinetics: { halfLife: "12 h" },
    interactionsNarrative: "Watch out for Z.",
    labelSections: { boxedWarning: "Serious warning." },
    approvalHistory: [
      { date: "2020-01-01", applicationNumber: "NDA000001", type: "NDA" },
    ],
    patientSummary: "Plain language summary.",
  });

  it("returns the record unchanged when no filter is requested", () => {
    expect(applyDrugSparseFields(full, null)).toBe(full);
  });

  it("keeps identity fields and strips everything else for an empty set", () => {
    const stripped = applyDrugSparseFields(full, new Set());
    expect(stripped.slug).toBe(full.slug);
    expect(stripped.name).toBe(full.name);
    expect(stripped.identifiers).toEqual(full.identifiers);
    expect(stripped.provenance).toEqual(full.provenance);
    expect(stripped.mechanism).toBeUndefined();
    expect(stripped.indications).toEqual([]);
    expect(stripped.contraindications).toEqual([]);
    expect(stripped.dosing).toEqual([]);
    expect(stripped.pharmacokinetics).toBeUndefined();
    expect(stripped.interactionsNarrative).toBeUndefined();
    expect(stripped.labelSections).toBeUndefined();
    expect(stripped.approvalHistory).toEqual([]);
    expect(stripped.patientSummary).toBeUndefined();
  });

  it("keeps exactly the requested sections", () => {
    const picked = applyDrugSparseFields(
      full,
      new Set(["mechanism", "labelSections"] as const),
    );
    expect(picked.mechanism).toEqual(full.mechanism);
    expect(picked.labelSections).toEqual(full.labelSections);
    expect(picked.indications).toEqual([]);
    expect(picked.dosing).toEqual([]);
  });

  it("always produces output that still validates against DrugSchema", () => {
    for (const fields of [
      new Set<never>(),
      new Set(["mechanism"] as const),
      new Set([...DRUG_SPARSE_SECTIONS]),
    ]) {
      const result = applyDrugSparseFields(
        full,
        fields as Parameters<typeof applyDrugSparseFields>[1],
      );
      expect(() => DrugSchema.parse(result)).not.toThrow();
    }
  });

  it("requesting every section round-trips the full record", () => {
    const all = applyDrugSparseFields(full, new Set([...DRUG_SPARSE_SECTIONS]));
    expect(all).toEqual(full);
  });
});
