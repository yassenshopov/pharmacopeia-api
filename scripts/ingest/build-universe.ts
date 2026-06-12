/**
 * scripts/ingest/build-universe.ts
 *
 * Build the programmatic candidate universe for the 5,000+ drug scale
 * ingest. Replaces the hand-curated ~300-name ceiling with the full
 * RxNorm ingredient space, tiered so partial runs cover the most
 * valuable records first:
 *
 *   tier 0 "curated"      — the hand-curated core list (known-good,
 *                            widely prescribed), in its original order.
 *   tier 1 "prescribable" — every ingredient (TTY=IN) in RxNorm's
 *                            Prescribable subset: substances present in
 *                            currently-marketed US products (~5,800).
 *   tier 2 "extended"     — the remaining full-RxNorm ingredients
 *                            (historical / discontinued / rare). Most
 *                            will fail the openFDA label gate at ingest
 *                            time; the ones that pass extend coverage
 *                            toward near-exhaustive US-FDA.
 *
 * Systematic chemical names ("((4-hydroxybutyl)azanediyl)bis(...)")
 * are filtered out up front — they are never openFDA generic names, so
 * probing them would only burn API budget.
 *
 * Output: data/ingest/universe.json (regenerate any time; one command).
 *
 * Run:   npm run ingest:universe
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CURATED_DRUG_NAMES } from "./curated-names";
import { fetchJson, slugify } from "./shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(REPO_ROOT, "data/ingest");
const OUT_FILE = resolve(OUT_DIR, "universe.json");

export type UniverseTier = "curated" | "prescribable" | "extended";

export interface UniverseCandidate {
  /** Lowercased RxNorm ingredient name (or curated name). */
  name: string;
  slug: string;
  tier: UniverseTier;
  /** Known RxCUI from allconcepts — skips the name→rxcui lookup at ingest. */
  rxcui?: string;
}

export interface UniverseFile {
  generatedAt: string;
  counts: Record<UniverseTier, number> & { total: number; filtered: number };
  candidates: UniverseCandidate[];
}

/**
 * Heuristic gate against systematic chemical nomenclature and other
 * non-drug noise in the full RxNorm ingredient list. Conservative on
 * purpose: a borderline name that slips through just fails the openFDA
 * label match later.
 */
export function isPlausibleDrugName(name: string): boolean {
  if (name.length < 3 || name.length > 60) return false;
  if (/[(),;:%<>{}\[\]=@#&*+]/.test(name)) return false;
  // pure registry-style tokens ("1,2-dioleoyl...", "9006-65-9")
  if (/^\d/.test(name)) return false;
  return true;
}

interface MinConcept {
  rxcui: string;
  name: string;
  tty: string;
}

async function fetchAllConcepts(url: string): Promise<MinConcept[]> {
  const resp = await fetchJson(url);
  const list: MinConcept[] = resp?.minConceptGroup?.minConcept ?? [];
  return list.filter((c) => c?.rxcui && c?.name);
}

async function main(): Promise<void> {
  process.stderr.write("Building drug universe from RxNorm...\n");

  const [prescribable, full] = [
    await fetchAllConcepts(
      "https://rxnav.nlm.nih.gov/REST/Prescribe/allconcepts.json?tty=IN",
    ),
    await fetchAllConcepts(
      "https://rxnav.nlm.nih.gov/REST/allconcepts.json?tty=IN",
    ),
  ];
  process.stderr.write(
    `  prescribable IN concepts: ${prescribable.length}\n` +
      `  full IN concepts:         ${full.length}\n`,
  );

  const candidates: UniverseCandidate[] = [];
  const seenSlugs = new Set<string>();
  let filtered = 0;

  // Tier 0: curated, original order, no rxcui (resolved by normalized
  // name search at ingest, exactly like the curated TS-seed pipeline).
  for (const name of CURATED_DRUG_NAMES) {
    const slug = slugify(name);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    candidates.push({ name, slug, tier: "curated" });
  }

  // Tier 1 / Tier 2: RxNorm ingredients, alphabetical within tier.
  const tiers: Array<{ tier: UniverseTier; concepts: MinConcept[] }> = [
    { tier: "prescribable", concepts: prescribable },
    { tier: "extended", concepts: full },
  ];
  for (const { tier, concepts } of tiers) {
    const sorted = [...concepts].sort((a, b) => a.name.localeCompare(b.name));
    for (const c of sorted) {
      const name = c.name.trim().toLowerCase();
      if (!isPlausibleDrugName(name)) {
        filtered++;
        continue;
      }
      const slug = slugify(name);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      candidates.push({ name, slug, tier, rxcui: c.rxcui });
    }
  }

  const counts = {
    curated: candidates.filter((c) => c.tier === "curated").length,
    prescribable: candidates.filter((c) => c.tier === "prescribable").length,
    extended: candidates.filter((c) => c.tier === "extended").length,
    total: candidates.length,
    filtered,
  };

  const out: UniverseFile = {
    generatedAt: new Date().toISOString(),
    counts,
    candidates,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 1), "utf8");

  process.stderr.write(
    `\nwrote ${OUT_FILE}\n` +
      `  curated:      ${counts.curated}\n` +
      `  prescribable: ${counts.prescribable}\n` +
      `  extended:     ${counts.extended}\n` +
      `  total:        ${counts.total} (filtered ${counts.filtered} implausible names)\n`,
  );
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isDirectRun) {
  main().catch((e) => {
    process.stderr.write(`\nFATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
    process.exit(1);
  });
}
