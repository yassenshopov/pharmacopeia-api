import type {
  Drug,
  DrugClass,
  Ingredient,
  ReactionSummary,
} from "@/lib/schemas";

/**
 * Canonical lowercase search haystacks, shared by every surface that
 * filters or searches entities by free text:
 *
 *  - `scripts/db/seed.ts` persists them into the `search_text` columns
 *    the Postgres backend filters with SQL `LIKE`;
 *  - `StaticRepository` applies them in memory;
 *  - the browse pages' `?q=` filter and `/api/v1/search` both resolve
 *    through one of those two paths.
 *
 * Keeping the composition here — and nowhere else — is what guarantees
 * the two backends can never disagree about what a query matches.
 */

export function drugSearchText(d: Drug): string {
  return [
    d.name,
    d.slug,
    ...d.synonyms,
    ...d.brands,
    ...d.ingredients.map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();
}

export function classSearchText(c: DrugClass): string {
  return [c.name, c.slug, c.kind, c.description ?? ""]
    .join(" ")
    .toLowerCase();
}

export function ingredientSearchText(i: Ingredient): string {
  return [i.name, i.slug, ...i.synonyms].join(" ").toLowerCase();
}

export function reactionSearchText(r: ReactionSummary): string {
  return [r.name, r.slug, ...r.aliases].join(" ").toLowerCase();
}

/** Normalise a caller-supplied `?q=` value; null means "no filter". */
export function normalizeQuery(q: string | undefined | null): string | null {
  const trimmed = q?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
