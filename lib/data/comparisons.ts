import type { DrugSummary } from "@/lib/schemas";

/**
 * Drug-vs-drug comparison pairs.
 *
 * "metformin vs glipizide", "lisinopril vs losartan" — same-class
 * contrasts are among the highest-volume real search queries in the
 * medication space, and our structured records make them cheap to
 * generate well. This module is the single source of truth for which
 * pairs exist as indexable `/compare/{a}-vs-{b}` pages: it feeds
 * `generateStaticParams`, the sitemap, and `llms.txt` so those surfaces
 * can never disagree about the pair universe.
 *
 * Slugs are forever (AGENTS.md), so the URL scheme is a permanent
 * commitment: the two slugs are always emitted in a canonical
 * alphabetical order joined by the literal `-vs-` delimiter. A request
 * for the non-canonical order is redirected to the canonical URL by the
 * page, never served as a duplicate.
 */

export const COMPARE_DELIMITER = "-vs-";

export interface ComparisonPair {
  /** Canonical alphabetical-first slug. */
  a: string;
  /** Canonical alphabetical-second slug. */
  b: string;
  /** Canonical URL path segment, `${a}-vs-${b}`. */
  slug: string;
}

/**
 * Hand-picked marquee comparisons that must always exist as pages even
 * if the windowed class pairing below wouldn't reach them. Mirrors the
 * interactive picker's sample set.
 */
const CURATED_PAIRS: readonly (readonly [string, string])[] = [
  ["metformin", "glipizide"],
  ["lisinopril", "losartan"],
  ["atorvastatin", "rosuvastatin"],
  ["atorvastatin", "simvastatin"],
  ["rosuvastatin", "simvastatin"],
  ["sertraline", "fluoxetine"],
  ["sertraline", "escitalopram"],
  ["escitalopram", "fluoxetine"],
  ["ibuprofen", "naproxen"],
  ["omeprazole", "pantoprazole"],
  ["amlodipine", "lisinopril"],
];

/** Build the canonical path segment for an unordered slug pair. */
export function comparePairSlug(slugA: string, slugB: string): string {
  const [a, b] = [slugA, slugB].sort();
  return `${a}${COMPARE_DELIMITER}${b}`;
}

/**
 * The curated marquee pairs, canonicalized. These are pre-rendered at
 * build time; every other pair from {@link buildComparisonPairs} renders
 * on demand (ISR) the first time it is requested. Cheap to compute (no
 * dataset access), so it is safe to call from `generateStaticParams`.
 */
export function curatedComparisonPairs(): ComparisonPair[] {
  const seen = new Set<string>();
  const out: ComparisonPair[] = [];
  for (const [x, y] of CURATED_PAIRS) {
    const [a, b] = [x, y].sort();
    const slug = `${a}${COMPARE_DELIMITER}${b}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ a, b, slug });
  }
  return out;
}

/**
 * Parse a `/compare/{pair}` segment into its two slugs. Returns `null`
 * when the segment is not exactly two non-empty slugs. Does not assert
 * canonical order — the caller decides whether to redirect.
 */
export function parseComparePairSlug(
  segment: string,
): { a: string; b: string } | null {
  const parts = segment.split(COMPARE_DELIMITER);
  if (parts.length !== 2) return null;
  const a = parts[0]?.trim().toLowerCase();
  const b = parts[1]?.trim().toLowerCase();
  if (!a || !b || a === b) return null;
  return { a, b };
}

/**
 * How many alphabetically-adjacent same-class peers each drug is paired
 * with. A sliding window keeps generation near-linear in the number of
 * drugs even when a class is huge (statins, SSRIs), so the pair universe
 * scales to a 5,000-drug dataset without a quadratic blow-up.
 */
const DEFAULT_WINDOW = 4;

/** Safety cap on the total pages emitted, independent of dataset size. */
const DEFAULT_MAX_PAIRS = 20_000;

/**
 * Generate the canonical set of comparison pairs from drug summaries.
 *
 * Pairs are drawn only from drugs that share a pharmacological class —
 * the comparisons that are actually meaningful (and searched). The
 * result is deterministic: drugs are sorted by slug, classes are visited
 * in sorted order, and a sliding window bounds the fan-out per drug.
 */
export function buildComparisonPairs(
  drugs: Pick<DrugSummary, "slug" | "classes">[],
  opts: { window?: number; max?: number } = {},
): ComparisonPair[] {
  const window = opts.window ?? DEFAULT_WINDOW;
  const max = opts.max ?? DEFAULT_MAX_PAIRS;
  const known = new Set(drugs.map((d) => d.slug));

  const byClass = new Map<string, string[]>();
  const sortedDrugs = [...drugs].sort((x, y) => x.slug.localeCompare(y.slug));
  for (const drug of sortedDrugs) {
    for (const cls of drug.classes) {
      const bucket = byClass.get(cls.slug);
      if (bucket) bucket.push(drug.slug);
      else byClass.set(cls.slug, [drug.slug]);
    }
  }

  const seen = new Set<string>();
  const pairs: ComparisonPair[] = [];

  const add = (slugA: string, slugB: string) => {
    if (slugA === slugB) return;
    if (!known.has(slugA) || !known.has(slugB)) return;
    const [a, b] = [slugA, slugB].sort();
    const slug = `${a}${COMPARE_DELIMITER}${b}`;
    if (seen.has(slug)) return;
    seen.add(slug);
    pairs.push({ a, b, slug });
  };

  // Curated marquee pairs first so they survive the cap.
  for (const [a, b] of CURATED_PAIRS) add(a, b);

  for (const classSlug of [...byClass.keys()].sort()) {
    const members = byClass.get(classSlug);
    if (!members || members.length < 2) continue;
    const unique = [...new Set(members)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j <= i + window && j < unique.length; j++) {
        add(unique[i], unique[j]);
        if (pairs.length >= max) return pairs;
      }
    }
  }

  return pairs;
}
