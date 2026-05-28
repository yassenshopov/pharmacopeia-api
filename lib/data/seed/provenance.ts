import type { Provenance } from "@/lib/schemas";

/**
 * Helper for building provenance records for the static seed dataset.
 * Real ingested records (drugs, classes, ingredients, structures, the
 * openFDA-derived interaction narratives) carry actual source hashes;
 * this helper exists for the rare hand-attached provenance stamp.
 */
export function seedProvenance(opts: {
  sourceUrl: string;
  extractor?: Provenance["extractor"];
  confidence?: number;
  hashSeed?: string;
}): Provenance {
  return {
    sourceUrl: opts.sourceUrl,
    sourceHash: `seed-${opts.hashSeed ?? opts.sourceUrl}`.slice(0, 64),
    extractedAt: "2026-05-28T00:00:00.000Z",
    extractor: opts.extractor ?? "manual",
    confidence: opts.confidence ?? 0.99,
  };
}
