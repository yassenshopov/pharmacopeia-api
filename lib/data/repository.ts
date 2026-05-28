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
import { MOCK_CLASSES, MOCK_CLASSES_BY_SLUG } from "./mock/classes";
import { MOCK_DRUGS, MOCK_DRUGS_BY_SLUG } from "./mock/drugs";
import { MOCK_INGREDIENTS, MOCK_INGREDIENTS_BY_SLUG } from "./mock/ingredients";
import { MOCK_INTERACTIONS } from "./mock/interactions";

/**
 * Repository interface that hides whether records come from mock JSON,
 * Supabase, or any other backend. Every public API route should depend
 * on this contract — never on the mock data directly.
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
// Mock implementation
// ────────────────────────────────────────────────────────────────────────

const VERSION = "v0.1.0-mock";
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

class MockRepository implements PharmacopeiaRepository {
  constructor() {
    // Fail-fast validation: every mock record must satisfy its schema.
    // This is the only place we re-validate mocks because once they're
    // valid here, types guarantee they stay valid downstream.
    MOCK_DRUGS.forEach((d) => DrugSchema.parse(d));
    MOCK_CLASSES.forEach((c) => DrugClassSchema.parse(c));
    MOCK_INGREDIENTS.forEach((i) => IngredientSchema.parse(i));
    MOCK_INTERACTIONS.forEach((x) => InteractionSchema.parse(x));
  }

  async getStats(): Promise<Stats> {
    const indicationsCount = MOCK_DRUGS.reduce(
      (acc, d) => acc + d.indications.length,
      0,
    );
    return {
      drugs: MOCK_DRUGS.length,
      classes: MOCK_CLASSES.length,
      ingredients: MOCK_INGREDIENTS.length,
      interactions: MOCK_INTERACTIONS.length,
      indications: indicationsCount,
      version: VERSION,
      updatedAt: UPDATED_AT,
    };
  }

  async listDrugs(
    opts: ListOpts & { classSlug?: string } = {},
  ): Promise<List<DrugSummary>> {
    let drugs = MOCK_DRUGS;
    if (opts.classSlug) {
      drugs = drugs.filter((d) =>
        d.classes.some((c) => c.slug === opts.classSlug),
      );
    }
    return paginate(drugs.map(toSummary), opts);
  }

  async getDrug(slug: string): Promise<Drug | null> {
    return MOCK_DRUGS_BY_SLUG[slug] ?? null;
  }

  async getDrugInteractions(slug: string): Promise<Interaction[]> {
    return MOCK_INTERACTIONS.filter(
      (x) => x.drugA === slug || x.drugB === slug,
    );
  }

  async listClasses(opts?: ListOpts): Promise<List<DrugClass>> {
    return paginate(MOCK_CLASSES, opts);
  }

  async getClass(slug: string): Promise<DrugClass | null> {
    return MOCK_CLASSES_BY_SLUG[slug] ?? null;
  }

  async listIngredients(opts?: ListOpts): Promise<List<Ingredient>> {
    return paginate(MOCK_INGREDIENTS, opts);
  }

  async getIngredient(slug: string): Promise<Ingredient | null> {
    return MOCK_INGREDIENTS_BY_SLUG[slug] ?? null;
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchResult[] = [];

    for (const d of MOCK_DRUGS) {
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

    for (const c of MOCK_CLASSES) {
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

    for (const i of MOCK_INGREDIENTS) {
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
        const match = MOCK_INTERACTIONS.find(
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
  if (!_repo) _repo = new MockRepository();
  return _repo;
}
