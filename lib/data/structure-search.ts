/**
 * Runtime 2D structure search over the same OpenChemLib 512-bit
 * substructure index that powers the offline per-drug `similar`
 * neighbour lists. The fingerprint vector for every drug is built lazily
 * once per process from `SEED_STRUCTURES`, and incoming queries are
 * scored against it with the Tanimoto coefficient.
 *
 * This is structural proximity only — same fingerprints, same caveats
 * as `/drug/{slug}/similar`. It is never a claim of therapeutic
 * equivalence.
 */
import * as OCL from "openchemlib";
import type { StructureMatch } from "@/lib/schemas";
import { SEED_DRUGS_BY_SLUG } from "./seed/drugs";
import { SEED_STRUCTURES } from "./seed/structures";

/**
 * Heavy-atom cap mirrors the offline similarity pipeline
 * (`scripts/ingest/fetch-similarity.ts`). The 512-bit OCL fingerprint
 * saturates for very large molecules (peptides, biologics) and reports
 * spurious similarity — excluding them at index time keeps the search
 * space clean and the rankings honest.
 */
const MAX_ATOMS = 70;

/**
 * Thrown when the caller-supplied SMILES cannot be parsed by
 * OpenChemLib. Route handlers should map this to a 400 with the
 * message verbatim — it's safe and useful for debugging the input.
 */
export class InvalidSmilesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSmilesError";
  }
}

interface IndexEntry {
  slug: string;
  name: string;
  smiles: string;
  className: string | undefined;
  /** OpenChemLib's 512-bit fingerprint as an integer array. */
  fingerprint: number[];
}

/** One indexable molecule, however the backend stores it. */
export interface StructureIndexInput {
  slug: string;
  name: string;
  smiles: string;
  className: string | undefined;
}

export type StructureIndex = IndexEntry[];

/**
 * Fingerprint every input molecule. Backend-agnostic: the static
 * repository feeds the seed files through this, the Postgres repository
 * feeds rows from the `structures` table. Inputs should be pre-sorted
 * by slug for stable result ordering.
 */
export function buildStructureIndex(
  inputs: StructureIndexInput[],
): StructureIndex {
  const out: IndexEntry[] = [];
  for (const input of inputs) {
    try {
      const mol = OCL.Molecule.fromSmiles(input.smiles);
      if (mol.getAtoms() > MAX_ATOMS) continue;
      out.push({ ...input, fingerprint: mol.getIndex() });
    } catch {
      // Same forgiveness as the offline pipeline — skip anything OCL
      // can't parse and keep going.
    }
  }
  return out;
}

let _index: IndexEntry[] | null = null;

function getIndex(): IndexEntry[] {
  if (!_index) {
    _index = buildStructureIndex(
      Object.keys(SEED_STRUCTURES)
        .sort()
        .flatMap((slug) => {
          const struct = SEED_STRUCTURES[slug];
          const drug = SEED_DRUGS_BY_SLUG[slug];
          if (!struct || !drug) return [];
          return [
            {
              slug,
              name: drug.name,
              smiles: struct.smiles,
              className:
                drug.classes.find((c) => c.kind === "epc")?.name ??
                drug.classes[0]?.name,
            },
          ];
        }),
    );
  }
  return _index;
}

/**
 * Rank every indexed drug by Tanimoto similarity to the query SMILES.
 * Returns the top `limit` matches with score ≥ `threshold`. Scores are
 * rounded to three decimals for stable, cache-friendly responses.
 *
 * Throws `InvalidSmilesError` if OpenChemLib cannot parse the input.
 */
export function searchByStructure(
  smiles: string,
  opts: { limit: number; threshold: number },
): StructureMatch[] {
  return searchStructureIndex(getIndex(), smiles, opts);
}

/** Run a SMILES query against an arbitrary prebuilt index. */
export function searchStructureIndex(
  index: StructureIndex,
  smiles: string,
  opts: { limit: number; threshold: number },
): StructureMatch[] {
  const trimmed = smiles.trim();
  if (!trimmed) {
    throw new InvalidSmilesError("SMILES is empty");
  }

  let queryFp: number[];
  try {
    const queryMol = OCL.Molecule.fromSmiles(trimmed);
    if (queryMol.getAllAtoms() === 0) {
      throw new InvalidSmilesError("SMILES parsed to zero atoms");
    }
    queryFp = queryMol.getIndex();
  } catch (err) {
    if (err instanceof InvalidSmilesError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new InvalidSmilesError(`Could not parse SMILES: ${msg}`);
  }

  const scored: StructureMatch[] = [];
  for (const entry of index) {
    const raw = OCL.SSSearcherWithIndex.getSimilarityTanimoto(
      queryFp,
      entry.fingerprint,
    );
    if (raw < opts.threshold) continue;
    scored.push({
      slug: entry.slug,
      name: entry.name,
      score: Math.round(raw * 1000) / 1000,
      className: entry.className,
      smiles: entry.smiles,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return scored.slice(0, opts.limit);
}

/** Number of structures currently in the in-memory index. */
export function indexedStructureCount(): number {
  return getIndex().length;
}
