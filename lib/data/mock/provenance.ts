import type { Provenance } from "@/lib/schemas";

/**
 * Helper for building provenance records in mock data. Real records
 * carry actual source hashes; mocks use a deterministic synthetic hash
 * so they roundtrip through Zod validation cleanly.
 */
export function mockProvenance(opts: {
  sourceUrl: string;
  extractor?: Provenance["extractor"];
  confidence?: number;
  hashSeed?: string;
}): Provenance {
  return {
    sourceUrl: opts.sourceUrl,
    sourceHash: `mock-${opts.hashSeed ?? opts.sourceUrl}`.slice(0, 64),
    extractedAt: "2026-05-28T00:00:00.000Z",
    extractor: opts.extractor ?? "manual",
    confidence: opts.confidence ?? 0.99,
  };
}
