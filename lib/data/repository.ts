import { z } from "zod";
import type {
  Drug,
  DrugClass,
  DrugSummary,
  Ingredient,
  Interaction,
  InteractionCheckResponse,
  Pagination,
} from "@/lib/schemas";
import {
  DrugSchema,
  DrugClassSchema,
  IngredientSchema,
  InteractionSchema,
  SeveritySchema,
} from "@/lib/schemas";
import { SEED_CLASSES, SEED_CLASSES_BY_SLUG } from "./seed/classes";
import { SEED_DRUGS, SEED_DRUGS_BY_SLUG } from "./seed/drugs";
import { getSeedInteractionsNarrative } from "./seed/drug-interactions-narratives";
import { SEED_INGREDIENTS, SEED_INGREDIENTS_BY_SLUG } from "./seed/ingredients";
import { SEED_INTERACTIONS } from "./seed/interactions";

/**
 * Repository interface that hides whether records come from the static
 * seed dataset, Supabase, or any other backend. Every public API route
 * should depend on this contract — never on the seed data directly.
 */
export interface PharmacopeiaRepository {
  getStats(): Promise<Stats>;

  listDrugs(opts?: ListOpts & { classSlug?: string }): Promise<List<DrugSummary>>;
  getDrug(slug: string): Promise<Drug | null>;
  getDrugInteractions(slug: string): Promise<Interaction[]>;

  listClasses(opts?: ListOpts): Promise<List<DrugClass>>;
  getClass(slug: string): Promise<DrugClass | null>;

  listIngredients(opts?: ListOpts): Promise<List<Ingredient>>;
  getIngredient(slug: string): Promise<Ingredient | null>;

  search(query: string, limit?: number): Promise<SearchResult[]>;

  checkInteractions(slugs: string[]): Promise<InteractionCheckResponse>;
}

export interface Stats {
  drugs: number;
  classes: number;
  ingredients: number;
  interactions: number;
  indications: number;
  version: string;
  updatedAt: string;
}

export interface ListOpts {
  limit?: number;
  offset?: number;
}

export interface List<T> {
  items: T[];
  pagination: Pagination;
}

export const SearchResultSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["drug", "ingredient", "class"]),
  description: z.string().optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

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
    opts: ListOpts & { classSlug?: string } = {},
  ): Promise<List<DrugSummary>> {
    let drugs = SEED_DRUGS;
    if (opts.classSlug) {
      drugs = drugs.filter((d) =>
        d.classes.some((c) => c.slug === opts.classSlug),
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
}

let _repo: PharmacopeiaRepository | null = null;
export function getRepository(): PharmacopeiaRepository {
  if (!_repo) _repo = new StaticRepository();
  return _repo;
}
