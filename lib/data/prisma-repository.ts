import type {
  AdverseEventStats,
  BrandEntry,
  ChangelogEntry,
  Condition,
  ConditionSummary,
  Drug,
  DrugClass,
  DrugLiterature,
  DrugPgx,
  DrugSummary,
  DrugTrials,
  Ingredient,
  Interaction,
  InteractionCheckResponse,
  Jurisdiction,
  LiteratureReference,
  PassageSection,
  Provenance,
  Reaction,
  ReactionMeta,
  ReactionSummary,
  SearchResult,
  ShortageEntry,
  SimilarDrugResult,
  Stats,
  StructureMatch,
} from "@/lib/schemas";
import { SeveritySchema } from "@/lib/schemas";
import { getPrismaClient } from "@/lib/db/client";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import {
  EMBEDDING_MODEL,
  embedQueryOrNull,
  toVectorLiteral,
} from "@/lib/ai/embeddings";
import {
  buildAtcGroups,
  buildAtcTree,
  buildBrands,
  buildMechanismGraph,
  toDrugSummary,
} from "./dataset-views";
import {
  buildReactionIndex,
  resolveReactionSlugInIndex,
  type ReactionIndex,
} from "./reactions-index";
import {
  buildConditionIndex,
  conditionSearchText,
  type ConditionIndex,
} from "./conditions-index";
import { applyControlledSubstanceCrosswalk } from "@/lib/ingest/controlled-substances";
import { normalizeQuery, reactionSearchText } from "./search-text";
import {
  buildStructureIndex,
  searchStructureIndex,
  type StructureIndex,
} from "./structure-search";
import {
  clampListOpts,
  toSemanticPassages,
  type AtcGroup,
  type AtcTreeNode,
  type List,
  type ListChangelogOpts,
  type ListOpts,
  type MechanismGraph,
  type PassageSearchResult,
  type PharmacopeiaRepository,
} from "./repository";
import {
  buildLexicalPassageIndex,
  buildPassages,
  searchLexicalPassageIndex,
  type LexicalPassageIndex,
} from "./passages";

/** Fallbacks when the dataset_meta row is missing (pre-seed database). */
const FALLBACK_VERSION = "v0.1.0-db";

/**
 * Repository implementation backed by Supabase Postgres through Prisma.
 *
 * Storage is document-style: every entity row carries its full
 * Zod-validated record as a jsonb `payload` (written by
 * `scripts/db/seed.ts`), plus extracted columns for filtering and
 * search. Point lookups and paginated lists are per-request SQL;
 * whole-dataset derived surfaces (brands crosswalk, ATC tree, MoA
 * graph, reactions index, structure-search fingerprints) are computed
 * once per process from a lazily-loaded snapshot and cached — the same
 * lifetime the static seed repository gives them, with the CDN cache
 * absorbing the cold-start cost.
 */
export class PrismaRepository implements PharmacopeiaRepository {
  private get db(): PrismaClient {
    return getPrismaClient();
  }

  /** Full drugs + classes snapshot for derived views. */
  private _snapshot: Promise<{ drugs: Drug[]; classes: DrugClass[] }> | null =
    null;
  private _reactionIndex: Promise<ReactionIndex> | null = null;
  private _conditionIndex: Promise<ConditionIndex> | null = null;
  private _structureIndex: Promise<StructureIndex> | null = null;
  private _lexicalPassageIndex: Promise<LexicalPassageIndex> | null = null;

  private snapshot(): Promise<{ drugs: Drug[]; classes: DrugClass[] }> {
    if (!this._snapshot) {
      this._snapshot = (async () => {
        const [drugRows, classRows] = await Promise.all([
          this.db.drug.findMany({
            orderBy: { slug: "asc" },
            select: { payload: true },
          }),
          this.db.drugClass.findMany({
            orderBy: { slug: "asc" },
            select: { payload: true },
          }),
        ]);
        return {
          drugs: drugRows.map((r) => r.payload as unknown as Drug),
          classes: classRows.map((r) => r.payload as unknown as DrugClass),
        };
      })().catch((err) => {
        // Don't cache a failed load — let the next request retry.
        this._snapshot = null;
        throw err;
      });
    }
    return this._snapshot;
  }

  private reactionIndex(): Promise<ReactionIndex> {
    if (!this._reactionIndex) {
      this._reactionIndex = (async () => {
        const [adverseRows, drugRows, metaRows] = await Promise.all([
          this.db.adverseEvents.findMany({ select: { payload: true } }),
          this.db.drug.findMany({ select: { slug: true, name: true } }),
          this.db.reactionMeta.findMany(),
        ]);
        const metaBySlug = new Map(
          metaRows.map((r) => [r.slug, r.payload as unknown as ReactionMeta]),
        );
        return buildReactionIndex({
          adverseEvents: adverseRows.map(
            (r) => r.payload as unknown as AdverseEventStats,
          ),
          drugNames: new Map(drugRows.map((d) => [d.slug, d.name])),
          getMeta: (slug) => metaBySlug.get(slug) ?? null,
        });
      })().catch((err) => {
        this._reactionIndex = null;
        throw err;
      });
    }
    return this._reactionIndex;
  }

  private conditionIndex(): Promise<ConditionIndex> {
    if (!this._conditionIndex) {
      this._conditionIndex = (async () => {
        const { drugs } = await this.snapshot();
        return buildConditionIndex({
          drugs: drugs.map((d) => ({
            slug: d.slug,
            name: d.name,
            indications: d.indications.map((i) => ({
              text: i.text,
              icd10: i.icd10,
            })),
          })),
        });
      })().catch((err) => {
        this._conditionIndex = null;
        throw err;
      });
    }
    return this._conditionIndex;
  }

  private structureIndex(): Promise<StructureIndex> {
    if (!this._structureIndex) {
      this._structureIndex = (async () => {
        const [structureRows, snapshot] = await Promise.all([
          this.db.structure.findMany({ orderBy: { drugSlug: "asc" } }),
          this.snapshot(),
        ]);
        const drugsBySlug = new Map(snapshot.drugs.map((d) => [d.slug, d]));
        return buildStructureIndex(
          structureRows.flatMap((row) => {
            const drug = drugsBySlug.get(row.drugSlug);
            if (!drug) return [];
            return [
              {
                slug: row.drugSlug,
                name: drug.name,
                smiles: row.smiles,
                className:
                  drug.classes.find((c) => c.kind === "epc")?.name ??
                  drug.classes[0]?.name,
              },
            ];
          }),
        );
      })().catch((err) => {
        this._structureIndex = null;
        throw err;
      });
    }
    return this._structureIndex;
  }

  async getStats(): Promise<Stats> {
    const [drugs, classes, ingredients, interactions, indications, meta] =
      await Promise.all([
        this.db.drug.count(),
        this.db.drugClass.count(),
        this.db.ingredient.count(),
        this.db.interaction.count(),
        this.db.drug.aggregate({ _sum: { indicationCount: true } }),
        this.db.datasetMeta.findUnique({ where: { id: 1 } }),
      ]);
    return {
      drugs,
      classes,
      ingredients,
      interactions,
      indications: indications._sum.indicationCount ?? 0,
      version: meta?.version ?? FALLBACK_VERSION,
      updatedAt: (meta?.updatedAt ?? new Date(0)).toISOString(),
    };
  }

  async listDrugs(
    opts: ListOpts & {
      classSlug?: string;
      ingredientSlug?: string;
      jurisdiction?: Jurisdiction;
    } = {},
  ): Promise<List<DrugSummary>> {
    const { limit, offset } = clampListOpts(opts);
    const q = normalizeQuery(opts.q);
    const where = {
      ...(opts.classSlug ? { classSlugs: { has: opts.classSlug } } : {}),
      ...(opts.ingredientSlug
        ? { ingredientSlugs: { has: opts.ingredientSlug } }
        : {}),
      ...(q ? { searchText: { contains: q } } : {}),
      // JSON-path filter; cardinality is tiny (a handful of agencies)
      // and v0 data is all US-FDA. Promote to an extracted column when
      // a second jurisdiction actually lands.
      ...(opts.jurisdiction
        ? { payload: { path: ["jurisdiction"], equals: opts.jurisdiction } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.drug.findMany({
        where,
        orderBy: { slug: "asc" },
        skip: offset,
        take: limit,
        select: { payload: true },
      }),
      this.db.drug.count({ where }),
    ]);
    return {
      items: rows.map((r) => toDrugSummary(r.payload as unknown as Drug)),
      pagination: { total, limit, offset },
    };
  }

  async getDrug(slug: string): Promise<Drug | null> {
    const row = await this.db.drug.findUnique({ where: { slug } });
    if (!row) return null;
    // Fill-only crosswalks at read so this backend serves the identical
    // record the static seed bakes at construction, regardless of when
    // the database was last seeded. Idempotent: a payload that already
    // carries the field is returned untouched.
    return applyControlledSubstanceCrosswalk(row.payload as unknown as Drug);
  }

  async getDrugsBatch(
    slugs: string[],
  ): Promise<{ found: Drug[]; missing: string[] }> {
    const unique = [...new Set(slugs)];
    const rows = await this.db.drug.findMany({
      where: { slug: { in: unique } },
      select: { slug: true, payload: true },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r.payload]));
    const found: Drug[] = [];
    const missing: string[] = [];
    for (const slug of unique) {
      const payload = bySlug.get(slug);
      if (payload)
        found.push(
          applyControlledSubstanceCrosswalk(payload as unknown as Drug),
        );
      else missing.push(slug);
    }
    return { found, missing };
  }

  async getDrugInteractions(slug: string): Promise<Interaction[]> {
    const rows = await this.db.interaction.findMany({
      where: { OR: [{ drugA: slug }, { drugB: slug }] },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.payload as unknown as Interaction);
  }

  async getSimilarDrugs(slug: string): Promise<SimilarDrugResult[]> {
    const row = await this.db.similarity.findUnique({
      where: { drugSlug: slug },
    });
    if (!row) return [];
    const neighbors = row.neighbors as unknown as {
      slug: string;
      score: number;
    }[];
    if (neighbors.length === 0) return [];
    const drugRows = await this.db.drug.findMany({
      where: { slug: { in: neighbors.map((n) => n.slug) } },
      select: { slug: true, payload: true },
    });
    const bySlug = new Map(
      drugRows.map((r) => [r.slug, r.payload as unknown as Drug]),
    );
    const results: SimilarDrugResult[] = [];
    for (const n of neighbors) {
      const d = bySlug.get(n.slug);
      if (!d) continue;
      results.push({
        slug: d.slug,
        name: d.name,
        score: n.score,
        className:
          d.classes.find((c) => c.kind === "epc")?.name ?? d.classes[0]?.name,
      });
    }
    return results;
  }

  async searchByStructure(
    smiles: string,
    opts: { limit: number; threshold: number },
  ): Promise<StructureMatch[]> {
    const index = await this.structureIndex();
    return searchStructureIndex(index, smiles, opts);
  }

  async listClasses(opts?: ListOpts): Promise<List<DrugClass>> {
    const { limit, offset } = clampListOpts(opts);
    const q = normalizeQuery(opts?.q);
    const where = q ? { searchText: { contains: q } } : {};
    const [rows, total] = await Promise.all([
      this.db.drugClass.findMany({
        where,
        orderBy: { slug: "asc" },
        skip: offset,
        take: limit,
        select: { payload: true },
      }),
      this.db.drugClass.count({ where }),
    ]);
    return {
      items: rows.map((r) => r.payload as unknown as DrugClass),
      pagination: { total, limit, offset },
    };
  }

  async getClass(slug: string): Promise<DrugClass | null> {
    const row = await this.db.drugClass.findUnique({ where: { slug } });
    return row ? (row.payload as unknown as DrugClass) : null;
  }

  async listIngredients(opts?: ListOpts): Promise<List<Ingredient>> {
    const { limit, offset } = clampListOpts(opts);
    const q = normalizeQuery(opts?.q);
    const where = q ? { searchText: { contains: q } } : {};
    const [rows, total] = await Promise.all([
      this.db.ingredient.findMany({
        where,
        orderBy: { slug: "asc" },
        skip: offset,
        take: limit,
        select: { payload: true },
      }),
      this.db.ingredient.count({ where }),
    ]);
    return {
      items: rows.map((r) => r.payload as unknown as Ingredient),
      pagination: { total, limit, offset },
    };
  }

  async getIngredient(slug: string): Promise<Ingredient | null> {
    const row = await this.db.ingredient.findUnique({ where: { slug } });
    return row ? (row.payload as unknown as Ingredient) : null;
  }

  /**
   * Dataset-wide views are precomputed by `scripts/db/seed.ts` into the
   * `derived_views` table so cold instances never load every payload
   * just to answer a browse endpoint. Falls back to building from the
   * full snapshot when the row (or the table itself, pre-`db push`) is
   * missing — both paths run the same pure builders, so the answer is
   * identical either way.
   */
  private async derivedView<T>(key: string): Promise<T | null> {
    try {
      const row = await this.db.derivedView.findUnique({ where: { key } });
      return row ? (row.payload as unknown as T) : null;
    } catch {
      return null;
    }
  }

  async listBrands(): Promise<BrandEntry[]> {
    const view = await this.derivedView<BrandEntry[]>("brands");
    if (view) return view;
    const { drugs } = await this.snapshot();
    return buildBrands(drugs);
  }

  async listAtcGroups(): Promise<AtcGroup[]> {
    const view = await this.derivedView<AtcGroup[]>("atc-groups");
    if (view) return view;
    const { classes } = await this.snapshot();
    return buildAtcGroups(classes);
  }

  async getAtcTree(): Promise<AtcTreeNode[]> {
    const view = await this.derivedView<AtcTreeNode[]>("atc-tree");
    if (view) return view;
    const { drugs, classes } = await this.snapshot();
    return buildAtcTree(drugs, classes);
  }

  async getMechanismGraph(): Promise<MechanismGraph> {
    const view = await this.derivedView<MechanismGraph>("mechanism-graph");
    if (view) return view;
    const { drugs } = await this.snapshot();
    return buildMechanismGraph(drugs);
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const [drugRows, classRows, ingredientRows] = await Promise.all([
      this.db.drug.findMany({
        where: { searchText: { contains: q } },
        orderBy: { slug: "asc" },
        take: limit,
        select: { payload: true },
      }),
      this.db.drugClass.findMany({
        where: { searchText: { contains: q } },
        orderBy: { slug: "asc" },
        take: limit,
        select: { payload: true },
      }),
      this.db.ingredient.findMany({
        where: { searchText: { contains: q } },
        orderBy: { slug: "asc" },
        take: limit,
        select: { payload: true },
      }),
    ]);

    const matches: SearchResult[] = [];
    for (const r of drugRows) {
      const d = r.payload as unknown as Drug;
      matches.push({
        slug: d.slug,
        name: d.name,
        kind: "drug",
        description: d.shortDescription,
      });
    }
    for (const r of classRows) {
      const c = r.payload as unknown as DrugClass;
      matches.push({
        slug: c.slug,
        name: c.name,
        kind: "class",
        description: c.description,
      });
    }
    for (const r of ingredientRows) {
      const i = r.payload as unknown as Ingredient;
      matches.push({ slug: i.slug, name: i.name, kind: "ingredient" });
    }
    return matches.slice(0, limit);
  }

  /**
   * Lexical fallback index, built from the same drug payloads via the
   * shared passage builder — identical passages to what the seed wrote
   * into `passages`, so the two retrieval paths can't disagree about
   * passage ids or text.
   */
  private lexicalPassageIndex(): Promise<LexicalPassageIndex> {
    if (!this._lexicalPassageIndex) {
      this._lexicalPassageIndex = (async () => {
        const { drugs } = await this.snapshot();
        return buildLexicalPassageIndex(buildPassages(drugs));
      })().catch((err) => {
        this._lexicalPassageIndex = null;
        throw err;
      });
    }
    return this._lexicalPassageIndex;
  }

  async searchPassages(
    query: string,
    opts: { limit: number; sections?: PassageSection[] },
  ): Promise<PassageSearchResult> {
    const vector = await embedQueryOrNull(query);
    if (vector) {
      const sectionFilter =
        opts.sections && opts.sections.length > 0
          ? Prisma.sql`AND section IN (${Prisma.join(opts.sections)})`
          : Prisma.empty;
      const literal = toVectorLiteral(vector);
      const rows = await this.db.$queryRaw<
        Array<{
          id: string;
          drug_slug: string;
          drug_name: string;
          section: string;
          chunk: number;
          text: string;
          provenance: unknown;
          score: number;
        }>
      >(Prisma.sql`
        SELECT id, drug_slug, drug_name, section, chunk, text, provenance,
               1 - (embedding <=> ${literal}::vector) AS score
        FROM passages
        WHERE embedding IS NOT NULL ${sectionFilter}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${opts.limit}
      `);
      // Zero rows means the embed pipeline hasn't run — fall through to
      // lexical instead of returning an empty result for every query.
      if (rows.length > 0) {
        return {
          method: "embedding",
          model: EMBEDDING_MODEL,
          results: rows.map((r) => ({
            id: r.id,
            drug: { slug: r.drug_slug, name: r.drug_name },
            section: r.section as PassageSection,
            chunk: r.chunk,
            text: r.text,
            score: Math.round(Math.min(Math.max(r.score, 0), 1) * 1000) / 1000,
            provenance: r.provenance as Provenance,
          })),
        };
      }
    }
    const index = await this.lexicalPassageIndex();
    const scored = searchLexicalPassageIndex(index, query, opts);
    return { method: "lexical", results: toSemanticPassages(scored) };
  }

  async checkInteractions(slugs: string[]): Promise<InteractionCheckResponse> {
    const unique = Array.from(new Set(slugs)).sort();
    // Pairs are stored canonically (drugA < drugB), so every candidate
    // pair maps to exactly one id.
    const pairIds: string[] = [];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        pairIds.push(`${unique[i]}|${unique[j]}`);
      }
    }
    const rows =
      pairIds.length > 0
        ? await this.db.interaction.findMany({
            where: { id: { in: pairIds } },
            orderBy: { id: "asc" },
          })
        : [];
    const pairs = rows.map((r) => r.payload as unknown as Interaction);

    const severityKeys = SeveritySchema.options;
    const summary = Object.fromEntries(
      severityKeys.map((k) => [k, 0]),
    ) as InteractionCheckResponse["summary"];
    for (const p of pairs) summary[p.severity] += 1;

    return { input: unique, pairs, summary };
  }

  async listInteractionNarrativeSlugs(): Promise<string[]> {
    const rows = await this.db.drug.findMany({
      where: { hasInteractionsNarrative: true },
      orderBy: { slug: "asc" },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  }

  async listChangelog(opts?: ListChangelogOpts): Promise<ChangelogEntry[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const sinceMs = opts?.since ? Date.parse(opts.since) : Number.NaN;
    const rows = await this.db.changelogEntry.findMany({
      where: Number.isFinite(sinceMs)
        ? { timestamp: { gt: new Date(sinceMs) } }
        : undefined,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return rows.map((r) => r.payload as unknown as ChangelogEntry);
  }

  async getDrugShortages(slug: string): Promise<ShortageEntry[]> {
    const rows = await this.db.shortage.findMany({
      where: { drugSlug: slug },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.payload as unknown as ShortageEntry);
  }

  async listShortages(): Promise<ShortageEntry[]> {
    const rows = await this.db.shortage.findMany();
    return rows
      .map((r) => r.payload as unknown as ShortageEntry)
      .sort((a, b) => {
        if (a.drug !== b.drug) return a.drug.localeCompare(b.drug);
        return a.presentation.localeCompare(b.presentation);
      });
  }

  async getAdverseEventStats(slug: string): Promise<AdverseEventStats | null> {
    const row = await this.db.adverseEvents.findUnique({
      where: { drugSlug: slug },
    });
    return row ? (row.payload as unknown as AdverseEventStats) : null;
  }

  async getDrugLiterature(slug: string): Promise<LiteratureReference[]> {
    const row = await this.db.literature.findUnique({
      where: { drugSlug: slug },
    });
    if (!row) return [];
    return (row.payload as unknown as DrugLiterature).references;
  }

  async getDrugTrials(slug: string): Promise<DrugTrials | null> {
    const row = await this.db.trials.findUnique({
      where: { drugSlug: slug },
    });
    return row ? (row.payload as unknown as DrugTrials) : null;
  }

  async getDrugPgx(slug: string): Promise<DrugPgx | null> {
    const row = await this.db.pgx.findUnique({
      where: { drugSlug: slug },
    });
    return row ? (row.payload as unknown as DrugPgx) : null;
  }

  async listReactions(opts?: ListOpts): Promise<List<ReactionSummary>> {
    const { limit, offset } = clampListOpts(opts);
    const index = await this.reactionIndex();
    const q = normalizeQuery(opts?.q);
    const summaries = q
      ? index.summaries.filter((r) => reactionSearchText(r).includes(q))
      : index.summaries;
    return {
      items: summaries.slice(offset, offset + limit),
      pagination: { total: summaries.length, limit, offset },
    };
  }

  async getReaction(slug: string): Promise<Reaction | null> {
    const index = await this.reactionIndex();
    const resolved = resolveReactionSlugInIndex(index, slug);
    if (!resolved) return null;
    return index.reactions.get(resolved.canonical) ?? null;
  }

  async resolveReactionSlug(
    slug: string,
  ): Promise<{ canonical: string; matched: string } | null> {
    const index = await this.reactionIndex();
    return resolveReactionSlugInIndex(index, slug);
  }

  async listConditions(opts?: ListOpts): Promise<List<ConditionSummary>> {
    const { limit, offset } = clampListOpts(opts);
    const index = await this.conditionIndex();
    const q = normalizeQuery(opts?.q);
    const summaries = q
      ? index.summaries.filter((c) => conditionSearchText(c).includes(q))
      : index.summaries;
    return {
      items: summaries.slice(offset, offset + limit),
      pagination: { total: summaries.length, limit, offset },
    };
  }

  async getCondition(slug: string): Promise<Condition | null> {
    const index = await this.conditionIndex();
    return index.conditions.get(slug) ?? null;
  }
}
