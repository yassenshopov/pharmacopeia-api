import type { Drug, Provenance } from "@/lib/schemas";
import { DrugSchema } from "@/lib/schemas";

export const TEST_PROVENANCE: Provenance = {
  sourceUrl: "https://example.com/label",
  sourceHash: "deadbeef",
  extractedAt: "2026-01-01T00:00:00.000Z",
  extractor: "test-fixture",
  confidence: 0.9,
};

/**
 * Build a minimal valid Drug record for unit tests. Everything not
 * supplied stays empty/absent; the result is parsed through DrugSchema
 * so a fixture can never drift from the real contract.
 */
export function makeDrug(
  overrides: Partial<Drug> & Pick<Drug, "slug" | "name">,
): Drug {
  return DrugSchema.parse({
    synonyms: [],
    jurisdiction: "US-FDA",
    ingredients: [{ slug: overrides.slug, name: overrides.name }],
    brands: [],
    classes: [],
    indications: [],
    contraindications: [],
    dosing: [],
    approvalHistory: [],
    identifiers: { ndc: [], atc: [] },
    provenance: TEST_PROVENANCE,
    ...overrides,
  });
}
