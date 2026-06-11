import type {
  AdverseEventStats,
  BrandEntry,
  ChangelogEntry,
  Drug,
  DrugClass,
  DrugSummary,
  Ingredient,
  Interaction,
  InteractionCheckResponse,
  LiteratureReference,
  Pagination,
  PassageSection,
  Reaction,
  ReactionSummary,
  RetrievalMethod,
  SearchResult,
  SemanticPassage,
  ShortageEntry,
  SimilarDrugResult,
  Stats,
  StructureMatch,
} from "@/lib/schemas";
import {
  AdverseEventStatsSchema,
  ChangelogEntrySchema,
  DrugLiteratureSchema,
  DrugSchema,
  DrugClassSchema,
  IngredientSchema,
  InteractionSchema,
  ReactionSchema,
  SeveritySchema,
  ShortageEntrySchema,
} from "@/lib/schemas";

// Re-exported so existing consumers can keep importing these types from
// the repository module while the Zod schemas stay the source of truth.
export type {
  BrandEntry,
  SearchResult,
  SimilarDrugResult,
  Stats,
} from "@/lib/schemas";
export { SearchResultSchema } from "@/lib/schemas";
import {
  buildAtcGroups,
  buildAtcTree,
  buildBrands,
  buildMechanismGraph,
  toDrugSummary,
} from "./dataset-views";
import { PrismaRepository } from "./prisma-repository";
import { SEED_CLASSES, SEED_CLASSES_BY_SLUG } from "./seed/classes";
import { SEED_DRUGS, SEED_DRUGS_BY_SLUG } from "./seed/drugs";
import {
  getSeedInteractionsNarrative,
  SEED_DRUG_INTERACTIONS_NARRATIVES,
} from "./seed/drug-interactions-narratives";
import { SEED_INGREDIENTS, SEED_INGREDIENTS_BY_SLUG } from "./seed/ingredients";
import { SEED_INTERACTIONS } from "./seed/interactions";
import { SEED_CHANGELOG } from "./seed/changelog";
import {
  getSeedAdverseEvents,
  SEED_ADVERSE_EVENTS,
} from "./seed/adverse-events";
import { getSeedLiterature, SEED_LITERATURE } from "./seed/literature";
import {
  getSeedShortages,
  listAllSeedShortages,
  SEED_SHORTAGES,
} from "./seed/shortages";
import { getSeedSimilar } from "./seed/similarity";
import { getReactionIndex, resolveReactionSlug } from "./reactions-index";
import { searchByStructure } from "./structure-search";
import {
  buildLexicalPassageIndex,
  buildPassages,
  searchLexicalPassageIndex,
  type LexicalPassageIndex,
  type ScoredPassage,
} from "./passages";

/**
 * Repository interface that hides whether records come from the static
 * seed dataset, Supabase, or any other backend. Every public API route
 * should depend on this contract — never on the seed data directly.
 */
export interface PharmacopeiaRepository {
  getStats(): Promise<Stats>;

  listDrugs(
    opts?: ListOpts & { classSlug?: string; ingredientSlug?: string },
  ): Promise<List<DrugSummary>>;
  getDrug(slug: string): Promise<Drug | null>;
  /**
   * Resolve many slug → Drug lookups in one call. Returns the full
   * records for every slug that resolved (deduped, in caller order)
   * plus the slugs that did not resolve so callers don't have to diff
   * the request and the response themselves.
   */
  getDrugsBatch(slugs: string[]): Promise<{
    found: Drug[];
    missing: string[];
  }>;
  getDrugInteractions(slug: string): Promise<Interaction[]>;

  /**
   * Structurally similar drugs (Tanimoto over 2D fingerprints),
   * precomputed offline. Educational structural proximity only — never
   * a claim of therapeutic equivalence.
   */
  getSimilarDrugs(slug: string): Promise<SimilarDrugResult[]>;

  /**
   * Rank every indexed drug by 2D Tanimoto similarity to the
   * caller-supplied SMILES. Same fingerprint family that powers the
   * offline per-drug analog lists, computed online against an arbitrary
   * query molecule. Throws `InvalidSmilesError` for unparseable input.
   * Structural proximity only — never a claim of therapeutic equivalence.
   */
  searchByStructure(
    smiles: string,
    opts: { limit: number; threshold: number },
  ): Promise<StructureMatch[]>;

  listClasses(opts?: ListOpts): Promise<List<DrugClass>>;
  getClass(slug: string): Promise<DrugClass | null>;

  listIngredients(opts?: ListOpts): Promise<List<Ingredient>>;
  getIngredient(slug: string): Promise<Ingredient | null>;

  /**
   * Brand → generic crosswalk. Every brand name across the dataset,
   * mapped to the generic drug(s) it markets. Lets a reader land on a
   * brand (Glucophage) and pivot to the generic (metformin).
   */
  listBrands(): Promise<BrandEntry[]>;

  /**
   * WHO ATC classification grouped by anatomical main group (level 1).
   * Each group lists the ATC subgroups present in the dataset.
   */
  listAtcGroups(): Promise<AtcGroup[]>;

  /**
   * The full WHO ATC hierarchy as a nested tree, levels 1→5. Levels 1–3
   * carry the WHO group names, level 4 maps to a class record, and level
   * 5 leaves are the substances (drugs) in the dataset that carry the
   * level-4 code. Built for the interactive ATC explorer.
   */
  getAtcTree(): Promise<AtcTreeNode[]>;

  /**
   * Mechanism-of-action graph: a tripartite network of drugs, the
   * mechanism-of-action classes they belong to, and the molecular
   * targets they act on. Assembled from drug class memberships and the
   * per-drug `mechanism.targets`. Educational structural view only.
   */
  getMechanismGraph(): Promise<MechanismGraph>;

  search(query: string, limit?: number): Promise<SearchResult[]>;

  /**
   * Semantic retrieval over drug-record passages. Embedding-backed
   * (pgvector cosine) on the Postgres backend when an embeddings
   * provider is configured; otherwise a lexical TF-IDF fallback over
   * the same passages. `method` in the result reports which path
   * answered — the response shape never changes.
   */
  searchPassages(
    query: string,
    opts: { limit: number; sections?: PassageSection[] },
  ): Promise<PassageSearchResult>;

  checkInteractions(slugs: string[]): Promise<InteractionCheckResponse>;

  /**
   * Slugs of drugs that carry an openFDA "drug interactions" narrative.
   * Surfaced as a set so the /interactions UI can mark which selected
   * drugs have a one-sided narrative to read, given the pair-graph
   * dataset is still empty.
   */
  listInteractionNarrativeSlugs(): Promise<string[]>;

  /**
   * Public "what's new" feed. Returns notable record-level and
   * surface-level changes, newest first. Powers `/feed.xml`,
   * `/feed.json`, and the `/changelog` HTML page so consumers and
   * curators can watch the dataset evolve without scraping.
   */
  listChangelog(opts?: ListChangelogOpts): Promise<ChangelogEntry[]>;

  /**
   * FDA shortage entries for a single drug. Returns every reported
   * presentation (strengths, dosage forms) of the drug currently
   * tracked on the openFDA shortages list, including resolved and
   * discontinued entries. Reference statistics only — for clinical
   * decisions, consult the FDA database directly.
   */
  getDrugShortages(slug: string): Promise<ShortageEntry[]>;

  /**
   * Every shortage entry across the dataset, sorted by drug then
   * presentation. Powers the `/shortages` browse index and refresh
   * monitoring.
   */
  listShortages(): Promise<ShortageEntry[]>;

  /**
   * Aggregate FAERS adverse-event counts for a single drug. Returns
   * `null` when the dataset has no snapshot for this drug — empty
   * results are NOT the same as zero reports. **These are voluntarily
   * submitted reports, not incidence rates, not signals, not
   * causality.** Reference statistics only.
   */
  getAdverseEventStats(slug: string): Promise<AdverseEventStats | null>;

  /**
   * Curated PubMed references for a drug. Pinned to MeSH major topic
   * at ingest time for precision; an empty list means no high-quality
   * match, not "no literature exists".
   */
  getDrugLiterature(slug: string): Promise<LiteratureReference[]>;

  /**
   * Browse index of reactions (MedDRA Preferred Terms) reported to
   * FAERS across the dataset. Ordered by total reporting volume desc.
   * Each summary carries `drugCount`, `totalReports`, and any
   * British/American spelling aliases. NOT a symptom checker.
   */
  listReactions(opts?: ListOpts): Promise<List<ReactionSummary>>;

  /**
   * One reaction with its full per-drug breakdown plus related
   * reactions ranked by Jaccard similarity over the drug-id sets. The
   * `slug` argument may be a canonical or an alias; use
   * {@link resolveReactionSlug} when the route needs to decide between
   * serving and 301-redirecting.
   */
  getReaction(slug: string): Promise<Reaction | null>;

  /**
   * Resolve a reaction slug to its canonical form, also reporting
   * whether the supplied slug matched the canonical or an alias. Lets
   * UI routes 301-redirect alias URLs to the canonical reaction page
   * without duplicating the index lookup.
   */
  resolveReactionSlug(
    slug: string,
  ): Promise<{ canonical: string; matched: string } | null>;
}

export interface PassageSearchResult {
  method: RetrievalMethod;
  /** Embedding model id when `method` is `embedding`. */
  model?: string;
  results: SemanticPassage[];
}

/** Shared scored-passage → API-shape mapping, used by both backends. */
export function toSemanticPassages(
  scored: ScoredPassage[],
): SemanticPassage[] {
  return scored.map(({ passage, score }) => ({
    id: passage.id,
    drug: { slug: passage.drugSlug, name: passage.drugName },
    section: passage.section,
    chunk: passage.chunk,
    text: passage.text,
    score,
    provenance: passage.provenance,
  }));
}

export interface ListChangelogOpts {
  /** Maximum number of entries to return; defaults to 50. */
  limit?: number;
  /** ISO timestamp; only entries strictly after this are returned. */
  since?: string;
}

export interface ListOpts {
  limit?: number;
  offset?: number;
}

export interface List<T> {
  items: T[];
  pagination: Pagination;
}

export interface AtcGroup {
  letter: string;
  name: string;
  classes: DrugClass[];
}

/**
 * A single node in the WHO ATC hierarchy (levels 1–5).
 *
 *  - `code`      : ATC code at this level (`C`, `C09`, `C09A`, `C09AA`),
 *                  or the drug slug at level 5.
 *  - `slug`      : the class record slug at level 4, or the drug slug at
 *                  level 5, for linking out. Absent on levels 1–3.
 *  - `drugCount` : number of distinct level-5 substances under this node.
 */
export interface AtcTreeNode {
  code: string;
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  slug?: string;
  drugCount: number;
  children: AtcTreeNode[];
}

export type MechanismNodeType = "drug" | "moa" | "target";

export interface MechanismGraphNode {
  /** Stable, namespaced id: `drug:<slug>`, `moa:<slug>`, `target:<name>`. */
  id: string;
  type: MechanismNodeType;
  label: string;
  /** Drug or class slug, for linking out. Absent on target nodes. */
  slug?: string;
  /** ATC level-1 letter for a drug (used for colour grouping). */
  group?: string;
  /** Number of incident edges; drives node sizing. */
  degree: number;
}

export interface MechanismGraphLink {
  source: string;
  target: string;
  /** `member` = drug↔MoA class, `target` = drug↔molecular target. */
  kind: "member" | "target";
}

export interface MechanismGraph {
  nodes: MechanismGraphNode[];
  links: MechanismGraphLink[];
}

// ────────────────────────────────────────────────────────────────────────
// Static seed implementation
// ────────────────────────────────────────────────────────────────────────

const VERSION = "v0.1.0-seed";
const UPDATED_AT = "2026-05-28T00:00:00.000Z";

/**
 * Clamp list options to the shared API limits (limit 1–200, default 50).
 * Exported for the Postgres repository so both backends paginate
 * identically.
 */
export function clampListOpts(opts?: ListOpts): {
  limit: number;
  offset: number;
} {
  return {
    limit: Math.min(Math.max(opts?.limit ?? 50, 1), 200),
    offset: Math.max(opts?.offset ?? 0, 0),
  };
}

function paginate<T>(items: T[], opts?: ListOpts): List<T> {
  const { limit, offset } = clampListOpts(opts);
  return {
    items: items.slice(offset, offset + limit),
    pagination: { total: items.length, limit, offset },
  };
}

/**
 * Repository implementation backed by the static TypeScript dataset in
 * `lib/data/seed/`. Used for local development and as the v0 fallback
 * when no `DATABASE_URL` is configured.
 */
class StaticRepository implements PharmacopeiaRepository {
  private _passageIndex: LexicalPassageIndex | null = null;

  constructor() {
    // Fail-fast validation: every seed record must satisfy its schema.
    // This is the only place we re-validate seed data because once it's
    // valid here, types guarantee it stays valid downstream.
    SEED_DRUGS.forEach((d) => DrugSchema.parse(d));
    SEED_CLASSES.forEach((c) => DrugClassSchema.parse(c));
    SEED_INGREDIENTS.forEach((i) => IngredientSchema.parse(i));
    SEED_INTERACTIONS.forEach((x) => InteractionSchema.parse(x));
    SEED_CHANGELOG.forEach((c) => ChangelogEntrySchema.parse(c));
    for (const entries of Object.values(SEED_SHORTAGES)) {
      for (const entry of entries) ShortageEntrySchema.parse(entry);
    }
    for (const stats of Object.values(SEED_ADVERSE_EVENTS)) {
      AdverseEventStatsSchema.parse(stats);
    }
    for (const lit of Object.values(SEED_LITERATURE)) {
      DrugLiteratureSchema.parse(lit);
    }
    // Reactions are *derived* from SEED_ADVERSE_EVENTS by
    // `reactions-index`. Materialise once here so any regression in the
    // builder fails fast at app start, not at the first request.
    const reactionIndex = getReactionIndex();
    for (const reaction of reactionIndex.reactions.values()) {
      ReactionSchema.parse(reaction);
    }
  }

  async getStats(): Promise<Stats> {
    const indicationsCount = SEED_DRUGS.reduce(
      (acc, d) => acc + d.indications.length,
      0,
    );
    return {
      drugs: SEED_DRUGS.length,
      classes: SEED_CLASSES.length,
      ingredients: SEED_INGREDIENTS.length,
      interactions: SEED_INTERACTIONS.length,
      indications: indicationsCount,
      version: VERSION,
      updatedAt: UPDATED_AT,
    };
  }

  async listDrugs(
    opts: ListOpts & { classSlug?: string; ingredientSlug?: string } = {},
  ): Promise<List<DrugSummary>> {
    let drugs = SEED_DRUGS;
    if (opts.classSlug) {
      drugs = drugs.filter((d) =>
        d.classes.some((c) => c.slug === opts.classSlug),
      );
    }
    if (opts.ingredientSlug) {
      drugs = drugs.filter((d) =>
        d.ingredients.some((i) => i.slug === opts.ingredientSlug),
      );
    }
    return paginate(drugs.map(toDrugSummary), opts);
  }

  async getDrug(slug: string): Promise<Drug | null> {
    const drug = SEED_DRUGS_BY_SLUG[slug];
    if (!drug) return null;
    if (drug.interactionsNarrative) return drug;
    const narrative = getSeedInteractionsNarrative(slug);
    if (!narrative) return drug;
    return { ...drug, interactionsNarrative: narrative.text };
  }

  async getDrugsBatch(
    slugs: string[],
  ): Promise<{ found: Drug[]; missing: string[] }> {
    const seen = new Set<string>();
    const found: Drug[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const drug = await this.getDrug(slug);
      if (drug) found.push(drug);
      else missing.push(slug);
    }
    return { found, missing };
  }

  async getDrugInteractions(slug: string): Promise<Interaction[]> {
    return SEED_INTERACTIONS.filter(
      (x) => x.drugA === slug || x.drugB === slug,
    );
  }

  async searchByStructure(
    smiles: string,
    opts: { limit: number; threshold: number },
  ): Promise<StructureMatch[]> {
    return searchByStructure(smiles, opts);
  }

  async getSimilarDrugs(slug: string): Promise<SimilarDrugResult[]> {
    const results: SimilarDrugResult[] = [];
    for (const s of getSeedSimilar(slug)) {
      const d = SEED_DRUGS_BY_SLUG[s.slug];
      if (!d) continue;
      results.push({
        slug: d.slug,
        name: d.name,
        score: s.score,
        className: d.classes.find((c) => c.kind === "epc")?.name ?? d.classes[0]?.name,
      });
    }
    return results;
  }

  async listClasses(opts?: ListOpts): Promise<List<DrugClass>> {
    return paginate(SEED_CLASSES, opts);
  }

  async getClass(slug: string): Promise<DrugClass | null> {
    return SEED_CLASSES_BY_SLUG[slug] ?? null;
  }

  async listIngredients(opts?: ListOpts): Promise<List<Ingredient>> {
    return paginate(SEED_INGREDIENTS, opts);
  }

  async getIngredient(slug: string): Promise<Ingredient | null> {
    return SEED_INGREDIENTS_BY_SLUG[slug] ?? null;
  }

  async listBrands(): Promise<BrandEntry[]> {
    return buildBrands(SEED_DRUGS);
  }

  async listAtcGroups(): Promise<AtcGroup[]> {
    return buildAtcGroups(SEED_CLASSES);
  }

  async getAtcTree(): Promise<AtcTreeNode[]> {
    return buildAtcTree(SEED_DRUGS, SEED_CLASSES);
  }

  async getMechanismGraph(): Promise<MechanismGraph> {
    return buildMechanismGraph(SEED_DRUGS);
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchResult[] = [];

    for (const d of SEED_DRUGS) {
      const haystack = [
        d.name,
        d.slug,
        ...d.synonyms,
        ...d.brands,
        ...d.ingredients.map((i) => i.name),
      ]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) {
        matches.push({
          slug: d.slug,
          name: d.name,
          kind: "drug",
          description: d.shortDescription,
        });
      }
    }

    for (const c of SEED_CLASSES) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      ) {
        matches.push({
          slug: c.slug,
          name: c.name,
          kind: "class",
          description: c.description,
        });
      }
    }

    for (const i of SEED_INGREDIENTS) {
      if (
        i.name.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q)
      ) {
        matches.push({ slug: i.slug, name: i.name, kind: "ingredient" });
      }
    }

    return matches.slice(0, limit);
  }

  /**
   * Lexical passage index over the seed drugs (narratives folded in,
   * same as getDrug serves them). Built lazily — most processes never
   * hit semantic search.
   */
  private passageIndex(): LexicalPassageIndex {
    if (!this._passageIndex) {
      const drugs = SEED_DRUGS.map((d) => {
        if (d.interactionsNarrative) return d;
        const narrative = getSeedInteractionsNarrative(d.slug);
        return narrative ? { ...d, interactionsNarrative: narrative.text } : d;
      });
      this._passageIndex = buildLexicalPassageIndex(buildPassages(drugs));
    }
    return this._passageIndex;
  }

  async searchPassages(
    query: string,
    opts: { limit: number; sections?: PassageSection[] },
  ): Promise<PassageSearchResult> {
    const scored = searchLexicalPassageIndex(this.passageIndex(), query, opts);
    return { method: "lexical", results: toSemanticPassages(scored) };
  }

  async checkInteractions(
    slugs: string[],
  ): Promise<InteractionCheckResponse> {
    const unique = Array.from(new Set(slugs)).sort();
    const pairs: Interaction[] = [];

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        const match = SEED_INTERACTIONS.find(
          (x) =>
            (x.drugA === a && x.drugB === b) ||
            (x.drugA === b && x.drugB === a),
        );
        if (match) pairs.push(match);
      }
    }

    const severityKeys = SeveritySchema.options;
    const summary = Object.fromEntries(
      severityKeys.map((k) => [k, 0]),
    ) as InteractionCheckResponse["summary"];
    for (const p of pairs) summary[p.severity] += 1;

    return { input: unique, pairs, summary };
  }

  async listInteractionNarrativeSlugs(): Promise<string[]> {
    return Object.keys(SEED_DRUG_INTERACTIONS_NARRATIVES).sort();
  }

  async listChangelog(opts?: ListChangelogOpts): Promise<ChangelogEntry[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const sinceMs = opts?.since ? Date.parse(opts.since) : Number.NaN;
    const cutoff = Number.isFinite(sinceMs) ? sinceMs : null;

    const entries = SEED_CHANGELOG.slice().sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
    const filtered =
      cutoff === null
        ? entries
        : entries.filter((e) => Date.parse(e.timestamp) > cutoff);
    return filtered.slice(0, limit);
  }

  async getDrugShortages(slug: string): Promise<ShortageEntry[]> {
    return getSeedShortages(slug);
  }

  async listShortages(): Promise<ShortageEntry[]> {
    return listAllSeedShortages();
  }

  async getAdverseEventStats(
    slug: string,
  ): Promise<AdverseEventStats | null> {
    return getSeedAdverseEvents(slug);
  }

  async getDrugLiterature(slug: string): Promise<LiteratureReference[]> {
    return getSeedLiterature(slug)?.references ?? [];
  }

  async listReactions(opts?: ListOpts): Promise<List<ReactionSummary>> {
    return paginate(getReactionIndex().summaries, opts);
  }

  async getReaction(slug: string): Promise<Reaction | null> {
    const resolved = resolveReactionSlug(slug);
    if (!resolved) return null;
    return getReactionIndex().reactions.get(resolved.canonical) ?? null;
  }

  async resolveReactionSlug(
    slug: string,
  ): Promise<{ canonical: string; matched: string } | null> {
    return resolveReactionSlug(slug);
  }
}

let _repo: PharmacopeiaRepository | null = null;
export function getRepository(): PharmacopeiaRepository {
  if (!_repo) {
    _repo =
      getRepositoryKind() === "supabase"
        ? new PrismaRepository()
        : new StaticRepository();
  }
  return _repo;
}

export type RepositoryKind = "static" | "supabase";

/**
 * Which backend is currently serving requests. Surfaced through the
 * `/api/v1/health` envelope so monitors can distinguish "API is up on
 * the real backend" from "API is up on the seed fallback" without
 * paying the cost of a real query. Mirrors the env switch in
 * `getRepository()`: when `DATABASE_URL` is set requests are served by
 * the Prisma-backed Supabase Postgres repository, otherwise by the
 * static seed.
 */
export function getRepositoryKind(): RepositoryKind {
  return process.env.DATABASE_URL ? "supabase" : "static";
}
