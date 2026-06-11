import { SEED_DRUGS_BY_SLUG } from "./seed/drugs";
import { SEED_ADVERSE_EVENTS } from "./seed/adverse-events";
import { getSeedReactionMeta } from "./seed/reaction-meta";
import {
  ADVERSE_EVENT_DISCLAIMER,
  type AdverseEventStats,
  type Reaction,
  type ReactionMeta,
  type ReactionSummary,
} from "@/lib/schemas";

/**
 * Reaction index: a fully-derived view of the FAERS aggregates in
 * `SEED_ADVERSE_EVENTS`, organised as MedDRA Preferred Terms.
 *
 * Why derived, not ingested:
 *   The per-drug FAERS dataset is the source of truth. A reaction is
 *   nothing more than a transposed pivot of that table, so materialising
 *   a separate seed file would just create a synchronisation hazard.
 *
 * What's in here:
 *   - Canonical reactions keyed by slug.
 *   - British/American alias map (Diarrhoea ↔ Diarrhea, Anaemia ↔
 *     Anemia, …) so URL hits on either spelling resolve to the same
 *     page and search engines don't see duplicate content.
 *   - Per-reaction drug rows ordered by share (count / drug.totalReports).
 *   - Related-reactions ranked by Jaccard similarity over the set of
 *     drugs that report each reaction. Pure data-derived graph density;
 *     no paid-licence MedDRA SOC hierarchy required.
 *
 * The whole thing is built once, lazily, on first access — and frozen
 * thereafter. The build is deterministic (sorted output, no clocks),
 * so re-runs against the same `SEED_ADVERSE_EVENTS` produce identical
 * structures.
 */

const RELATED_TOP_N = 10;
const RELATED_MIN_SHARED_DRUGS = 2;

// ────────────────────────────────────────────────────────────────────────
// Canonicalisation
// ────────────────────────────────────────────────────────────────────────

/**
 * Slugify a free-form MedDRA Preferred Term to `lower-kebab` form.
 * Exported so the drug detail page can compute reaction link targets
 * from the same raw FAERS terms without going through a repository
 * round trip — both surfaces stay in lockstep on what counts as the
 * canonical slug.
 */
export function slugifyReactionName(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const slugify = slugifyReactionName;

/**
 * Produce the American-English spelling of a MedDRA term when it
 * differs from the British form FAERS uses. The transformations are
 * conservative and limited to the patterns that actually appear in
 * MedDRA: digraphs `oe`/`ae` collapse to `e`, the `-our` suffix
 * collapses to `-or`. Anything else is left alone, so neutral terms
 * (Headache, Nausea) come back unchanged.
 *
 * Returns `null` when no transformation applies — that's the signal
 * "this term has no American alias", which we use to skip aliasing
 * neutral terms.
 */
function americaniseSpelling(term: string): string | null {
  let out = term;
  out = out.replace(/oe/g, "e");
  out = out.replace(/OE/g, "E");
  out = out.replace(/ae/g, "e");
  out = out.replace(/AE/g, "E");
  out = out.replace(/(\w)our\b/g, "$1or");
  out = out.replace(/(\w)OUR\b/g, "$1OR");
  return out === term ? null : out;
}

// ────────────────────────────────────────────────────────────────────────
// Build
// ────────────────────────────────────────────────────────────────────────

interface BuiltReaction {
  slug: string;
  name: string;
  aliases: string[];
  /** drugSlug → row. */
  drugRows: Map<string, {
    drug: string;
    name: string;
    count: number;
    /** null when drugTotalReports is 0 (upstream FAERS denominator missing). */
    share: number | null;
    drugTotalReports: number;
  }>;
  /** Set of drug slugs reporting this reaction. Used for Jaccard. */
  drugSet: Set<string>;
  totalReports: number;
}

/**
 * Compute the share of a drug's FAERS reports that mentioned a given
 * reaction. Returns `null` (not 0, not 1) when the drug's total report
 * count is missing — this happens when the upstream openFDA totals
 * query was rate-limited during ingest, and conflating that case with
 * a real 0/100% share would mislead consumers.
 */
function safeShare(count: number, drugTotalReports: number): number | null {
  if (drugTotalReports <= 0) return null;
  return Math.min(1, count / drugTotalReports);
}

export interface ReactionIndex {
  /** Canonical reactions keyed by canonical slug. */
  reactions: Map<string, Reaction>;
  /** Summaries in the API browse order (totalReports desc, then name). */
  summaries: ReactionSummary[];
  /**
   * Alias slug → canonical slug. Includes self-mappings (`canonical →
   * canonical`) so callers can always look up unconditionally and check
   * `match.slug === slug` to detect aliases.
   */
  aliasMap: Map<string, string>;
}

/**
 * Backend-agnostic inputs for the index build. The static repository
 * feeds the seed files through this; the Postgres repository feeds the
 * same shapes loaded from the database.
 */
export interface ReactionIndexInputs {
  adverseEvents: AdverseEventStats[];
  /** Drug slug → display name, for the per-reaction drug rows. */
  drugNames: ReadonlyMap<string, string>;
  /** Reference metadata lookup by canonical reaction slug. */
  getMeta: (slug: string) => ReactionMeta | null;
}

let _cached: ReactionIndex | null = null;

export function buildReactionIndex(inputs: ReactionIndexInputs): ReactionIndex {
  // Phase 1: scan every drug's top reactions, register canonical
  // slugs and aliases, and accumulate per-drug rows under the
  // canonical slug. Two terms that share a canonical slug (e.g.
  // collisions between FAERS-supplied British and any stray American
  // spellings) get merged into a single record with summed counts.
  const built = new Map<string, BuiltReaction>();
  /** Track aliases discovered for each canonical slug. */
  const aliasMap = new Map<string, string>();

  for (const stats of inputs.adverseEvents) {
    const drugName = inputs.drugNames.get(stats.drug);
    if (!drugName) continue;
    const drugTotalReports = stats.totalReports;

    for (const reaction of stats.topReactions) {
      const name = reaction.reaction.trim();
      if (!name) continue;
      const canonicalSlug = slugify(name);
      if (!canonicalSlug) continue;

      let entry = built.get(canonicalSlug);
      if (!entry) {
        entry = {
          slug: canonicalSlug,
          name,
          aliases: [],
          drugRows: new Map(),
          drugSet: new Set(),
          totalReports: 0,
        };
        built.set(canonicalSlug, entry);
        aliasMap.set(canonicalSlug, canonicalSlug);
      }

      // Aliases derived from the canonical name itself — same for every
      // row, only added once.
      if (entry.aliases.length === 0) {
        const american = americaniseSpelling(name);
        if (american && american !== name) {
          entry.aliases.push(american);
          const aliasSlug = slugify(american);
          if (
            aliasSlug &&
            aliasSlug !== canonicalSlug &&
            !aliasMap.has(aliasSlug)
          ) {
            aliasMap.set(aliasSlug, canonicalSlug);
          }
        }
      }

      // Merge into the per-drug row, summing if the same drug ever
      // contributes the same reaction twice (e.g. once under each
      // spelling — vanishingly rare in MedDRA-coded data but cheap to
      // handle).
      const existing = entry.drugRows.get(stats.drug);
      if (existing) {
        existing.count += reaction.count;
        existing.share = safeShare(existing.count, drugTotalReports);
      } else {
        entry.drugRows.set(stats.drug, {
          drug: stats.drug,
          name: drugName,
          count: reaction.count,
          share: safeShare(reaction.count, drugTotalReports),
          drugTotalReports,
        });
      }
      entry.drugSet.add(stats.drug);
      entry.totalReports += reaction.count;
    }
  }

  // Phase 2: collapse any alias whose slug accidentally collides with a
  // canonical (e.g. if a stray American spelling and the British form
  // both appear in source). Absorb counts into the British canonical
  // and drop the American canonical so we serve a single page per
  // concept.
  for (const [aliasSlug, canonicalSlug] of [...aliasMap.entries()]) {
    if (aliasSlug === canonicalSlug) continue;
    const aliasEntry = built.get(aliasSlug);
    const canonicalEntry = built.get(canonicalSlug);
    if (!aliasEntry || !canonicalEntry) continue;
    for (const [drugSlug, row] of aliasEntry.drugRows) {
      const existing = canonicalEntry.drugRows.get(drugSlug);
      if (existing) {
        existing.count += row.count;
        existing.share = safeShare(existing.count, row.drugTotalReports);
      } else {
        canonicalEntry.drugRows.set(drugSlug, { ...row });
      }
      canonicalEntry.drugSet.add(drugSlug);
    }
    canonicalEntry.totalReports += aliasEntry.totalReports;
    if (!canonicalEntry.aliases.includes(aliasEntry.name)) {
      canonicalEntry.aliases.push(aliasEntry.name);
    }
    built.delete(aliasSlug);
  }

  // Phase 3: related reactions via Jaccard over drug sets. Streamed by
  // co-occurrence rather than the naive O(R²) pair iteration so 700
  // reactions × 308 drugs stays well under a millisecond at module load.
  /** canonicalSlug → Map<otherSlug, sharedDrugs>. */
  const cooccurrence = new Map<string, Map<string, number>>();
  // Iterate drugs and for each drug, increment co-occurrence for every
  // pair of reactions it carries.
  const drugReactionLists = new Map<string, string[]>();
  for (const [slug, entry] of built) {
    for (const drugSlug of entry.drugSet) {
      const list = drugReactionLists.get(drugSlug) ?? [];
      list.push(slug);
      drugReactionLists.set(drugSlug, list);
    }
  }
  for (const list of drugReactionLists.values()) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      let aRow = cooccurrence.get(a);
      if (!aRow) {
        aRow = new Map();
        cooccurrence.set(a, aRow);
      }
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        aRow.set(b, (aRow.get(b) ?? 0) + 1);
      }
    }
  }

  // Phase 4: materialise the public Reaction objects.
  const reactions = new Map<string, Reaction>();
  for (const [slug, entry] of built) {
    // Sort by share desc with raw-count desc as the tiebreaker. Rows
    // whose `share` is `null` (denominator missing) fall to the bottom
    // of the share-based ranking but stay sorted among themselves by
    // count so the page still surfaces the highest reporting volumes.
    const drugRows = [...entry.drugRows.values()].sort((a, b) => {
      const aShare = a.share ?? -1;
      const bShare = b.share ?? -1;
      if (bShare !== aShare) return bShare - aShare;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    const myDrugCount = entry.drugSet.size;
    const coRow = cooccurrence.get(slug) ?? new Map();
    const related = [...coRow.entries()]
      .filter(([, shared]) => shared >= RELATED_MIN_SHARED_DRUGS)
      .map(([otherSlug, shared]) => {
        const other = built.get(otherSlug);
        if (!other) return null;
        const union = myDrugCount + other.drugSet.size - shared;
        const similarity = union > 0 ? shared / union : 0;
        return {
          slug: otherSlug,
          name: other.name,
          sharedDrugs: shared,
          similarity,
        };
      })
      .filter(
        (r): r is NonNullable<typeof r> =>
          r !== null && r.similarity > 0,
      )
      .sort((a, b) => {
        if (b.similarity !== a.similarity) return b.similarity - a.similarity;
        if (b.sharedDrugs !== a.sharedDrugs)
          return b.sharedDrugs - a.sharedDrugs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, RELATED_TOP_N);

    reactions.set(slug, {
      slug,
      name: entry.name,
      aliases: [...entry.aliases],
      drugCount: myDrugCount,
      totalReports: entry.totalReports,
      drugs: drugRows,
      relatedReactions: related,
      // Reference metadata (MeSH scope note + tree position + recent
      // PubMed papers) is supplied by the backend (seed file or
      // database). Many MedDRA terms have no MeSH counterpart
      // (administrative terms like "Drug Ineffective"), so `null` is
      // the honest signal — never invent.
      meta: inputs.getMeta(slug),
      disclaimer: ADVERSE_EVENT_DISCLAIMER,
    });
  }

  // Browse order: highest total reporting volume first so the dense
  // end of the FAERS distribution surfaces immediately. Ties broken by
  // name for stability.
  const summaries: ReactionSummary[] = [...reactions.values()]
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      aliases: r.aliases,
      drugCount: r.drugCount,
      totalReports: r.totalReports,
    }))
    .sort((a, b) => {
      if (b.totalReports !== a.totalReports)
        return b.totalReports - a.totalReports;
      return a.name.localeCompare(b.name);
    });

  return { reactions, summaries, aliasMap };
}

/** Seed-backed index, built lazily once per process. */
export function getReactionIndex(): ReactionIndex {
  if (!_cached) {
    _cached = buildReactionIndex({
      adverseEvents: Object.values(SEED_ADVERSE_EVENTS),
      drugNames: new Map(
        Object.values(SEED_DRUGS_BY_SLUG).map((d) => [d.slug, d.name]),
      ),
      getMeta: getSeedReactionMeta,
    });
  }
  return _cached;
}

/**
 * Resolve a slug (canonical or alias) to its canonical form within an
 * index. Returns `null` when neither the canonical map nor the alias
 * map knows the slug. Callers use the return value to decide whether to
 * redirect (`matched !== canonical`) or render straight
 * (`matched === canonical`).
 */
export function resolveReactionSlugInIndex(
  idx: ReactionIndex,
  slug: string,
): { canonical: string; matched: string } | null {
  if (idx.reactions.has(slug)) return { canonical: slug, matched: slug };
  const canonical = idx.aliasMap.get(slug);
  if (canonical && idx.reactions.has(canonical)) {
    return { canonical, matched: slug };
  }
  return null;
}

/** Seed-backed variant of {@link resolveReactionSlugInIndex}. */
export function resolveReactionSlug(
  slug: string,
): { canonical: string; matched: string } | null {
  return resolveReactionSlugInIndex(getReactionIndex(), slug);
}
