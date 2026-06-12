/**
 * lib/data/fuzzy-search.ts
 *
 * Typo-tolerant search fallback. When exact substring search comes up
 * empty (`search()` on both repositories), this re-ranks candidate
 * entity names by trigram similarity so "metfornin" still finds
 * metformin.
 *
 * The scorer is a single pure module shared by both backends — the
 * StaticRepository feeds it seed names, the PrismaRepository feeds it
 * the lightweight `name` columns — so the fallback returns identical
 * results whether the data lives in the bundle or in Postgres. That
 * parity is the whole reason the scoring lives here and nowhere else.
 *
 * Trigram similarity mirrors Postgres `pg_trgm`: a string is lowercased,
 * its non-alphanumeric runs collapsed to single spaces, padded with two
 * leading and one trailing space, and cut into 3-grams. Similarity is
 * the Jaccard coefficient (|A ∩ B| / |A ∪ B|) over the two trigram sets.
 * Doing it in JS — rather than leaning on the pg_trgm extension on one
 * backend only — is what keeps the two backends from drifting.
 */

import type { SearchResult } from "@/lib/schemas";

type SearchResultKind = SearchResult["kind"];

/** Default minimum Jaccard similarity for a fuzzy match to count. */
export const FUZZY_THRESHOLD = 0.3;

/** Normalise a string into pg_trgm-style trigrams. */
export function trigrams(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const grams = new Set<string>();
  if (normalized.length === 0) return grams;
  // pg_trgm pads each word; we pad the whole normalised string the same
  // way (two leading spaces, one trailing) so short names still produce
  // boundary trigrams.
  const padded = `  ${normalized} `;
  for (let i = 0; i < padded.length - 2; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Jaccard trigram similarity in [0, 1]. Two identical normalised strings
 * score 1; disjoint strings score 0.
 */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  // Iterate the smaller set for the intersection count.
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const gram of small) {
    if (large.has(gram)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** One fuzzy-search candidate: a searchable name plus its identity. */
export interface FuzzyCandidate {
  slug: string;
  name: string;
  kind: SearchResultKind;
}

/**
 * Rank candidates by trigram similarity to `query`, keeping only those
 * at or above `threshold`. Ties break by name length (shorter first)
 * then slug, so the ordering is deterministic across backends — the
 * contract suite depends on it.
 *
 * Results carry no `description`: the fallback path scores against the
 * primary name only, and both backends must emit byte-identical rows,
 * so the heavier description lookups are deliberately skipped.
 */
export function rankFuzzy(
  query: string,
  candidates: Iterable<FuzzyCandidate>,
  opts: { limit: number; threshold?: number },
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const threshold = opts.threshold ?? FUZZY_THRESHOLD;

  const scored: { candidate: FuzzyCandidate; score: number }[] = [];
  for (const candidate of candidates) {
    const score = trigramSimilarity(q, candidate.name);
    if (score >= threshold) scored.push({ candidate, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.candidate.name.length !== b.candidate.name.length) {
      return a.candidate.name.length - b.candidate.name.length;
    }
    return a.candidate.slug.localeCompare(b.candidate.slug);
  });

  return scored.slice(0, opts.limit).map(({ candidate }) => ({
    slug: candidate.slug,
    name: candidate.name,
    kind: candidate.kind,
  }));
}
