import type {
  BrandEntry,
  ChangelogEntry,
  Drug,
  DrugClass,
  DrugSummary,
  Ingredient,
  Interaction,
  InteractionCheckResponse,
  Pagination,
  SearchResult,
  SimilarDrugResult,
  Stats,
  StructureMatch,
} from "@/lib/schemas";
import {
  ChangelogEntrySchema,
  DrugSchema,
  DrugClassSchema,
  IngredientSchema,
  InteractionSchema,
  SeveritySchema,
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
import { atcLevel2Name, atcLevel3Name } from "./atc-names";
import { SEED_CLASSES, SEED_CLASSES_BY_SLUG } from "./seed/classes";
import { SEED_DRUGS, SEED_DRUGS_BY_SLUG } from "./seed/drugs";
import {
  getSeedInteractionsNarrative,
  SEED_DRUG_INTERACTIONS_NARRATIVES,
} from "./seed/drug-interactions-narratives";
import { SEED_INGREDIENTS, SEED_INGREDIENTS_BY_SLUG } from "./seed/ingredients";
import { SEED_INTERACTIONS } from "./seed/interactions";
import { SEED_CHANGELOG } from "./seed/changelog";
import { getSeedSimilar } from "./seed/similarity";
import { searchByStructure } from "./structure-search";

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

/**
 * WHO ATC level-1 anatomical main groups. Static, canonical, and
 * complete (14 groups). RxClass only hands us the deeper subgroups, so
 * we supply the top level ourselves to anchor the hierarchy.
 */
const ATC_LEVEL1: ReadonlyArray<{ letter: string; name: string }> = [
  { letter: "A", name: "Alimentary tract and metabolism" },
  { letter: "B", name: "Blood and blood forming organs" },
  { letter: "C", name: "Cardiovascular system" },
  { letter: "D", name: "Dermatologicals" },
  { letter: "G", name: "Genito-urinary system and sex hormones" },
  {
    letter: "H",
    name: "Systemic hormonal preparations, excluding sex hormones and insulins",
  },
  { letter: "J", name: "Antiinfectives for systemic use" },
  { letter: "L", name: "Antineoplastic and immunomodulating agents" },
  { letter: "M", name: "Musculo-skeletal system" },
  { letter: "N", name: "Nervous system" },
  {
    letter: "P",
    name: "Antiparasitic products, insecticides and repellents",
  },
  { letter: "R", name: "Respiratory system" },
  { letter: "S", name: "Sensory organs" },
  { letter: "V", name: "Various" },
];

// ────────────────────────────────────────────────────────────────────────
// Static seed implementation
// ────────────────────────────────────────────────────────────────────────

const VERSION = "v0.1.0-seed";
const UPDATED_AT = "2026-05-28T00:00:00.000Z";

function paginate<T>(items: T[], opts?: ListOpts): List<T> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const offset = Math.max(opts?.offset ?? 0, 0);
  return {
    items: items.slice(offset, offset + limit),
    pagination: { total: items.length, limit, offset },
  };
}

function toSummary(d: Drug): DrugSummary {
  return {
    slug: d.slug,
    name: d.name,
    synonyms: d.synonyms,
    jurisdiction: d.jurisdiction,
    ingredients: d.ingredients,
    brands: d.brands,
    classes: d.classes,
    shortDescription: d.shortDescription,
  };
}

/**
 * Repository implementation backed by the static TypeScript dataset in
 * `lib/data/seed/`. Used for local development and as the v0 fallback
 * when no `DATABASE_URL` is configured.
 */
class StaticRepository implements PharmacopeiaRepository {
  constructor() {
    // Fail-fast validation: every seed record must satisfy its schema.
    // This is the only place we re-validate seed data because once it's
    // valid here, types guarantee it stays valid downstream.
    SEED_DRUGS.forEach((d) => DrugSchema.parse(d));
    SEED_CLASSES.forEach((c) => DrugClassSchema.parse(c));
    SEED_INGREDIENTS.forEach((i) => IngredientSchema.parse(i));
    SEED_INTERACTIONS.forEach((x) => InteractionSchema.parse(x));
    SEED_CHANGELOG.forEach((c) => ChangelogEntrySchema.parse(c));
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
    return paginate(drugs.map(toSummary), opts);
  }

  async getDrug(slug: string): Promise<Drug | null> {
    const drug = SEED_DRUGS_BY_SLUG[slug];
    if (!drug) return null;
    if (drug.interactionsNarrative) return drug;
    const narrative = getSeedInteractionsNarrative(slug);
    if (!narrative) return drug;
    return { ...drug, interactionsNarrative: narrative.text };
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
    const map = new Map<string, { brand: string; drugs: Map<string, string> }>();
    for (const d of SEED_DRUGS) {
      for (const brand of d.brands) {
        const key = brand.toLowerCase();
        let entry = map.get(key);
        if (!entry) {
          entry = { brand, drugs: new Map() };
          map.set(key, entry);
        }
        entry.drugs.set(d.slug, d.name);
      }
    }
    return [...map.values()]
      .map((e) => ({
        brand: e.brand,
        drugs: [...e.drugs.entries()]
          .map(([slug, name]) => ({ slug, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }

  async listAtcGroups(): Promise<AtcGroup[]> {
    const byLetter = new Map<string, DrugClass[]>();
    for (const c of SEED_CLASSES) {
      if (c.kind !== "atc" || !c.code) continue;
      const letter = c.code[0].toUpperCase();
      const list = byLetter.get(letter) ?? [];
      list.push(c);
      byLetter.set(letter, list);
    }
    const groups: AtcGroup[] = [];
    for (const { letter, name } of ATC_LEVEL1) {
      const classes = byLetter.get(letter);
      if (!classes || classes.length === 0) continue;
      classes.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
      groups.push({ letter, name, classes });
    }
    return groups;
  }

  async getAtcTree(): Promise<AtcTreeNode[]> {
    // Level-4 substances first: which drugs carry which level-4 code.
    const drugsByL4 = new Map<string, { slug: string; name: string }[]>();
    for (const d of SEED_DRUGS) {
      const codes = new Set<string>();
      for (const c of d.classes) {
        if (c.kind === "atc" && c.code) codes.add(c.code);
      }
      for (const code of d.identifiers.atc) codes.add(code);
      for (const code of codes) {
        const list = drugsByL4.get(code) ?? [];
        list.push({ slug: d.slug, name: d.name });
        drugsByL4.set(code, list);
      }
    }

    const l1Name = new Map(ATC_LEVEL1.map((g) => [g.letter, g.name]));
    const roots = new Map<string, AtcTreeNode>();

    const ensure = (
      map: Map<string, AtcTreeNode>,
      code: string,
      level: 1 | 2 | 3 | 4,
      name: string,
      slug?: string,
    ): AtcTreeNode => {
      let node = map.get(code);
      if (!node) {
        node = { code, level, name, slug, children: [], drugCount: 0 };
        map.set(code, node);
      }
      return node;
    };

    const childMap = (parent: AtcTreeNode): Map<string, AtcTreeNode> => {
      // Lazily index this parent's children by code for O(1) lookup.
      const m = new Map<string, AtcTreeNode>();
      for (const child of parent.children) m.set(child.code, child);
      return m;
    };

    for (const cls of SEED_CLASSES) {
      if (cls.kind !== "atc" || !cls.code || cls.code.length < 5) continue;
      const code = cls.code;
      const l1 = code[0];
      const l2 = code.slice(0, 3);
      const l3 = code.slice(0, 4);

      const l1Node = ensure(roots, l1, 1, l1Name.get(l1) ?? l1);
      const l2Map = childMap(l1Node);
      const before2 = l2Map.size;
      const l2Node = ensure(l2Map, l2, 2, atcLevel2Name(l2));
      if (l2Map.size !== before2) l1Node.children.push(l2Node);

      const l3Map = childMap(l2Node);
      const before3 = l3Map.size;
      const l3Node = ensure(l3Map, l3, 3, atcLevel3Name(l3));
      if (l3Map.size !== before3) l2Node.children.push(l3Node);

      const l4Node: AtcTreeNode = {
        code,
        level: 4,
        name: cls.name,
        slug: cls.slug,
        drugCount: 0,
        children: [],
      };
      l3Node.children.push(l4Node);

      const substances = drugsByL4.get(code) ?? [];
      substances.sort((a, b) => a.name.localeCompare(b.name));
      for (const s of substances) {
        l4Node.children.push({
          code: s.slug,
          level: 5,
          name: s.name,
          slug: s.slug,
          drugCount: 1,
          children: [],
        });
      }
      l4Node.drugCount = substances.length;
    }

    // Roll drug counts up the tree and sort every level by code/name.
    const finalize = (node: AtcTreeNode): number => {
      if (node.level === 5) return 1;
      let total = 0;
      for (const child of node.children) total += finalize(child);
      if (node.level === 4) total = node.drugCount;
      else node.drugCount = total;
      node.children.sort((a, b) =>
        node.level >= 4
          ? a.name.localeCompare(b.name)
          : a.code.localeCompare(b.code),
      );
      return total;
    };

    const result = [...roots.values()];
    for (const root of result) finalize(root);
    result.sort((a, b) => a.code.localeCompare(b.code));
    return result;
  }

  async getMechanismGraph(): Promise<MechanismGraph> {
    const nodes = new Map<string, MechanismGraphNode>();
    const linkSet = new Set<string>();
    const links: MechanismGraphLink[] = [];

    const addNode = (
      id: string,
      type: MechanismNodeType,
      label: string,
      extra?: { slug?: string; group?: string },
    ) => {
      let node = nodes.get(id);
      if (!node) {
        node = { id, type, label, degree: 0, ...extra };
        nodes.set(id, node);
      }
      return node;
    };

    const addLink = (
      source: string,
      target: string,
      kind: MechanismGraphLink["kind"],
    ) => {
      const key = `${source}|${target}`;
      if (linkSet.has(key)) return;
      linkSet.add(key);
      links.push({ source, target, kind });
      const s = nodes.get(source);
      const t = nodes.get(target);
      if (s) s.degree += 1;
      if (t) t.degree += 1;
    };

    for (const d of SEED_DRUGS) {
      const atcLetter = d.classes.find((c) => c.kind === "atc" && c.code)
        ?.code?.[0];
      const drugId = `drug:${d.slug}`;
      addNode(drugId, "drug", d.name, { slug: d.slug, group: atcLetter });

      for (const c of d.classes) {
        if (c.kind !== "moa") continue;
        const moaId = `moa:${c.slug}`;
        addNode(moaId, "moa", c.name, { slug: c.slug });
        addLink(drugId, moaId, "member");
      }

      for (const target of d.mechanism?.targets ?? []) {
        const clean = target.trim();
        if (!clean) continue;
        const targetId = `target:${clean.toLowerCase()}`;
        addNode(targetId, "target", clean);
        addLink(drugId, targetId, "target");
      }
    }

    return { nodes: [...nodes.values()], links };
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
}

let _repo: PharmacopeiaRepository | null = null;
export function getRepository(): PharmacopeiaRepository {
  if (!_repo) _repo = new StaticRepository();
  return _repo;
}
