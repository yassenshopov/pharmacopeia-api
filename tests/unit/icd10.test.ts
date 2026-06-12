import { describe, expect, it } from "vitest";

import {
  applyIcd10Crosswalk,
  ICD10_CROSSWALK,
  icd10ForText,
} from "@/lib/ingest/icd10";
import { makeDrug } from "../helpers/fixtures";

describe("icd10ForText", () => {
  it("maps unambiguous condition phrases to ICD-10-CM codes", () => {
    expect(icd10ForText("for the treatment of hypertension")).toEqual(["I10"]);
    expect(
      icd10ForText("adjunct to diet in adults with type 2 diabetes mellitus"),
    ).toEqual(["E11.9"]);
  });

  it("does not fire the generic hypertension code on pulmonary hypertension", () => {
    const codes = icd10ForText("treatment of pulmonary arterial hypertension");
    expect(codes).toContain("I27.0");
    expect(codes).not.toContain("I10");
  });

  it("collects codes from multiple matching conditions", () => {
    const codes = icd10ForText(
      "Herpes Zoster Infections: indicated for the acute treatment of " +
        "herpes zoster (shingles). Genital Herpes: indicated for the " +
        "treatment of initial episodes of genital herpes.",
    );
    expect(codes).toContain("B02.9");
    expect(codes).toContain("A60.9");
  });

  it("matches OTC symptom phrasing", () => {
    const codes = icd10ForText(
      "temporarily relieves minor aches and pains due to: headache the " +
        "common cold backache toothache temporarily reduces fever",
    );
    expect(codes).toContain("R51.9"); // headache
    expect(codes).toContain("J00"); // common cold
    expect(codes).toContain("R50.9"); // fever
  });

  it("returns an empty array when nothing matches", () => {
    expect(icd10ForText("a sentence about nothing clinical")).toEqual([]);
  });

  it("is deterministic, deduped, sorted, and capped", () => {
    const text = ICD10_CROSSWALK.map((e) => e.label).join(". ");
    const codes = icd10ForText(text);
    expect(codes.length).toBeLessThanOrEqual(8);
    expect([...codes].sort()).toEqual(codes);
    expect(new Set(codes).size).toBe(codes.length);
    expect(icd10ForText(text)).toEqual(codes);
  });
});

describe("applyIcd10Crosswalk", () => {
  it("fills empty icd10 arrays and reports change via identity", () => {
    const drug = makeDrug({
      slug: "test-drug",
      name: "Test Drug",
      indications: [
        { text: "for the treatment of hypertension", icd10: [], snomed: [] },
      ],
    });
    const enriched = applyIcd10Crosswalk(drug);
    expect(enriched).not.toBe(drug);
    expect(enriched.indications[0].icd10).toEqual(["I10"]);
  });

  it("never overwrites codes that are already present", () => {
    const drug = makeDrug({
      slug: "test-drug",
      name: "Test Drug",
      indications: [
        {
          text: "for the treatment of hypertension",
          icd10: ["I10.X-CURATED"],
          snomed: [],
        },
      ],
    });
    expect(applyIcd10Crosswalk(drug)).toBe(drug);
  });

  it("returns the same object when nothing matches", () => {
    const drug = makeDrug({
      slug: "test-drug",
      name: "Test Drug",
      indications: [{ text: "nothing clinical here", icd10: [], snomed: [] }],
    });
    expect(applyIcd10Crosswalk(drug)).toBe(drug);
  });
});
