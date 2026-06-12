import { describe, expect, it } from "vitest";

import {
  buildShortageCrosswalk,
  buildShortageEntries,
  hashShortageRecord,
  joinCandidates,
  shortageDatasetHash,
  statusFromOpenFda,
  toIsoDate,
  type OpenFdaShortageRecord,
} from "@/lib/ingest/shortages";

const EXTRACTED_AT = "2026-06-01T00:00:00.000Z";

function record(over: Partial<OpenFdaShortageRecord> = {}): OpenFdaShortageRecord {
  return {
    generic_name: "Metformin Hydrochloride Tablet",
    presentation: "Metformin 500 mg tablet (NDC 0000-0000-00)",
    status: "Current",
    company_name: "Example Pharma",
    update_date: "05/26/2026",
    openfda: { substance_name: ["METFORMIN HYDROCHLORIDE"] },
    ...over,
  };
}

describe("statusFromOpenFda", () => {
  it("maps openFDA statuses onto the schema enum", () => {
    expect(statusFromOpenFda("Current")).toBe("active");
    expect(statusFromOpenFda("Resolved")).toBe("resolved");
    expect(statusFromOpenFda("To Be Discontinued")).toBe("to-be-discontinued");
    expect(statusFromOpenFda("Discontinued")).toBe("discontinuation");
  });

  it("returns null for unknown or missing statuses", () => {
    expect(statusFromOpenFda("Weird")).toBeNull();
    expect(statusFromOpenFda(undefined)).toBeNull();
  });
});

describe("toIsoDate", () => {
  it("converts MM/DD/YYYY and passes through ISO", () => {
    expect(toIsoDate("05/26/2026", "2026-01-01")).toBe("2026-05-26");
    expect(toIsoDate("2026-05-26", "2026-01-01")).toBe("2026-05-26");
  });

  it("falls back when missing or unparseable", () => {
    expect(toIsoDate(undefined, "2026-01-01")).toBe("2026-01-01");
    expect(toIsoDate("not a date", "2026-01-01")).toBe("2026-01-01");
  });
});

describe("joinCandidates", () => {
  it("prefers openfda canonical names and strips dosage forms", () => {
    const candidates = joinCandidates(record());
    expect(candidates).toContain("metformin hydrochloride");
    expect(candidates).toContain("metformin hydrochloride tablet");
  });
});

describe("buildShortageEntries", () => {
  const crosswalk = buildShortageCrosswalk([
    { slug: "metformin", names: ["Metformin", "Metformin Hydrochloride"] },
  ]);

  it("joins rows onto drugs and validates against the schema", () => {
    const { bySlug, total, unmatched } = buildShortageEntries(
      [record()],
      crosswalk,
      EXTRACTED_AT,
    );
    expect(total).toBe(1);
    expect(unmatched).toBe(0);
    const entries = bySlug.get("metformin")!;
    expect(entries[0].status).toBe("active");
    expect(entries[0].fdaUpdatedAt).toBe("2026-05-26");
    expect(entries[0].provenance.extractedAt).toBe(EXTRACTED_AT);
  });

  it("counts unmatched and unknown-status rows without including them", () => {
    const { total, unmatched, unknownStatus } = buildShortageEntries(
      [
        record({ openfda: { substance_name: ["UNKNOWN SUBSTANCE"] }, generic_name: "Unknown" }),
        record({ status: "Mystery" }),
      ],
      crosswalk,
      EXTRACTED_AT,
    );
    expect(total).toBe(0);
    expect(unmatched).toBe(1);
    expect(unknownStatus).toBe(1);
  });
});

describe("shortageDatasetHash", () => {
  const crosswalk = buildShortageCrosswalk([
    { slug: "metformin", names: ["Metformin Hydrochloride"] },
  ]);

  it("is stable across runs with different extractedAt timestamps", () => {
    const a = buildShortageEntries([record()], crosswalk, EXTRACTED_AT);
    const b = buildShortageEntries(
      [record()],
      crosswalk,
      "2026-06-02T12:34:56.000Z",
    );
    expect(shortageDatasetHash(a.bySlug)).toBe(shortageDatasetHash(b.bySlug));
  });

  it("changes when upstream content changes", () => {
    const a = buildShortageEntries([record()], crosswalk, EXTRACTED_AT);
    const b = buildShortageEntries(
      [record({ status: "Resolved" })],
      crosswalk,
      EXTRACTED_AT,
    );
    expect(shortageDatasetHash(a.bySlug)).not.toBe(shortageDatasetHash(b.bySlug));
  });
});

describe("hashShortageRecord", () => {
  it("ignores fields that aren't part of the stable subset", () => {
    expect(hashShortageRecord(record())).toBe(
      hashShortageRecord(record({ related_info: "extra noise" })),
    );
  });
});
