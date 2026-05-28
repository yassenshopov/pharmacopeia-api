/**
 * scripts/ingest/fetch-similarity.ts
 *
 * Precomputes structural similarity between every drug that has a
 * single-component SMILES in `SEED_STRUCTURES`, using OpenChemLib's
 * 512-bit substructure index and Tanimoto coefficient. No network: this
 * runs purely over the SMILES we already ingested from PubChem.
 *
 * Writes `lib/data/seed/similarity.ts`:
 *   Record<slug, Array<{ slug, score }>>  (top-N analogs per drug)
 *
 * Idempotent and deterministic: same SMILES in → byte-identical file.
 *
 * Tunables (env):
 *   SIM_THRESHOLD  minimum Tanimoto to keep a pair      (default 0.75)
 *   SIM_TOP_N      max analogs stored per drug          (default 8)
 *   SIM_MAX_ATOMS  skip molecules above this heavy-atom (default 70)
 *                  count — the 512-bit fingerprint saturates for large
 *                  peptides/biologics and reports spurious similarity.
 *   SIM_PROBE=1    print raw top-6 neighbours (pre-threshold) for a few
 *                  probe drugs, to help tune the threshold.
 *
 * Run: npm run ingest:similarity
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as OCL from "openchemlib";
import { SEED_STRUCTURES } from "../../lib/data/seed/structures";
import { SEED_DRUGS_BY_SLUG } from "../../lib/data/seed/drugs";

const OUT = join(process.cwd(), "lib", "data", "seed", "similarity.ts");
const THRESHOLD = clampNum(process.env.SIM_THRESHOLD, 0.75, 0, 1);
const TOP_N = Math.trunc(clampNum(process.env.SIM_TOP_N, 8, 1, 50));
const MAX_ATOMS = Math.trunc(clampNum(process.env.SIM_MAX_ATOMS, 70, 10, 1000));
const PROBE = process.env.SIM_PROBE === "1";

function clampNum(
  raw: string | undefined,
  fallback: number,
  lo: number,
  hi: number,
): number {
  const n = raw == null ? NaN : Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, lo), hi);
}

interface Analog {
  slug: string;
  score: number;
}

function main(): void {
  const slugs = Object.keys(SEED_STRUCTURES).sort();
  console.error(
    `[fetch-similarity] indexing ${slugs.length} structures ` +
      `(threshold=${THRESHOLD}, topN=${TOP_N}, maxAtoms=${MAX_ATOMS})`,
  );

  // Build the OCL substructure index for each drug once. Skip molecules
  // above the heavy-atom cap — fingerprint Tanimoto saturates for large
  // peptides/biologics and would link e.g. insulin to any other peptide.
  const indexes = new Map<string, number[]>();
  const skipped: string[] = [];
  let tooBig = 0;
  for (const slug of slugs) {
    const smiles = SEED_STRUCTURES[slug]?.smiles;
    if (!smiles) {
      skipped.push(slug);
      continue;
    }
    try {
      const mol = OCL.Molecule.fromSmiles(smiles);
      if (mol.getAtoms() > MAX_ATOMS) {
        tooBig += 1;
        skipped.push(slug);
        continue;
      }
      indexes.set(slug, mol.getIndex());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ! ${slug}: index failed (${msg})`);
      skipped.push(slug);
    }
  }

  const indexed = [...indexes.keys()].sort();

  if (PROBE) {
    runProbe(indexed, indexes);
  }

  // Symmetric top-N neighbour lists. Compute the upper triangle once and
  // push the score into both drugs' candidate lists.
  const neighbours = new Map<string, Analog[]>();
  for (const slug of indexed) neighbours.set(slug, []);

  for (let i = 0; i < indexed.length; i++) {
    const a = indexed[i];
    const ia = indexes.get(a)!;
    for (let j = i + 1; j < indexed.length; j++) {
      const b = indexed[j];
      const ib = indexes.get(b)!;
      const score = OCL.SSSearcherWithIndex.getSimilarityTanimoto(ia, ib);
      if (score < THRESHOLD) continue;
      const rounded = Math.round(score * 1000) / 1000;
      neighbours.get(a)!.push({ slug: b, score: rounded });
      neighbours.get(b)!.push({ slug: a, score: rounded });
    }
  }

  // Sort each list by score desc, then slug asc, and cap at TOP_N.
  const result: Record<string, Analog[]> = {};
  let withAnalogs = 0;
  let totalPairs = 0;
  let maxList = 0;
  for (const slug of indexed) {
    const list = neighbours
      .get(slug)!
      .sort((x, y) => y.score - x.score || x.slug.localeCompare(y.slug))
      .slice(0, TOP_N);
    if (list.length === 0) continue;
    result[slug] = list;
    withAnalogs += 1;
    totalPairs += list.length;
    maxList = Math.max(maxList, list.length);
  }

  writeOut(result);

  // Sample a few for eyeballing the score distribution.
  const samples = ["atorvastatin", "lisinopril", "ibuprofen", "sertraline"];
  console.error("[fetch-similarity] samples:");
  for (const s of samples) {
    const list = result[s];
    if (!list) {
      console.error(`  - ${s}: (no structure / no analogs)`);
      continue;
    }
    const pretty = list
      .map((a) => `${a.slug}:${a.score.toFixed(2)}`)
      .join(", ");
    console.error(`  - ${s}: ${pretty}`);
  }

  console.error(
    `[fetch-similarity] done — ${withAnalogs}/${indexed.length} drugs have ≥1 analog; ` +
      `avg list ${withAnalogs ? (totalPairs / withAnalogs).toFixed(1) : 0}; max ${maxList}; ` +
      `${skipped.length} skipped (${tooBig} over ${MAX_ATOMS} heavy atoms)`,
  );
}

/**
 * Diagnostic: print the raw top-6 neighbours (ignoring threshold) for a
 * handful of probe drugs across different chemotypes, so the threshold
 * can be tuned against real score distributions.
 */
function runProbe(indexed: string[], indexes: Map<string, number[]>): void {
  const probes = [
    "atorvastatin",
    "ibuprofen",
    "sertraline",
    "lisinopril",
    "amoxicillin",
    "omeprazole",
    "metformin",
  ];
  console.error("[fetch-similarity] PROBE (raw top-6, pre-threshold):");
  for (const p of probes) {
    const ip = indexes.get(p);
    if (!ip) {
      console.error(`  - ${p}: (not indexed)`);
      continue;
    }
    const scored = indexed
      .filter((s) => s !== p)
      .map((s) => ({
        slug: s,
        score: OCL.SSSearcherWithIndex.getSimilarityTanimoto(ip, indexes.get(s)!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((a) => `${a.slug}:${a.score.toFixed(2)}`)
      .join(", ");
    console.error(`  - ${p}: ${scored}`);
  }
}

function writeOut(result: Record<string, Analog[]>): void {
  const slugs = Object.keys(result).sort();
  const lines = slugs.map((slug) => {
    const list = result[slug]
      .map((a) => `{ slug: ${JSON.stringify(a.slug)}, score: ${a.score} }`)
      .join(", ");
    // Annotate with the human name as a trailing comment for readability.
    const name = SEED_DRUGS_BY_SLUG[slug]?.name ?? slug;
    return `  ${JSON.stringify(slug)}: [${list}], // ${name}`;
  });

  const file = `// AUTO-GENERATED by scripts/ingest/fetch-similarity.ts
// Structural-similarity neighbours computed with OpenChemLib's 512-bit
// substructure index + Tanimoto coefficient over PubChem SMILES.
// Educational structural proximity only — NOT a claim of clinical or
// therapeutic equivalence. Re-run \`npm run ingest:similarity\` to refresh.

export interface SimilarDrug {
  slug: string;
  score: number;
}

export const SEED_SIMILARITY: Record<string, SimilarDrug[]> = {
${lines.join("\n")}
};

export function getSeedSimilar(slug: string): SimilarDrug[] {
  return SEED_SIMILARITY[slug] ?? [];
}
`;
  writeFileSync(OUT, file, "utf8");
  console.error(`[fetch-similarity] wrote ${slugs.length} entries to ${OUT}`);
}

main();
