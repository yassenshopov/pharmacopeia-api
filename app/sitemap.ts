import type { MetadataRoute } from "next";
import type { List } from "@/lib/data/repository";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * The sitemap is pulled directly from the repository so adding a drug
 * or class to `lib/data/seed/` (or Supabase) automatically surfaces it
 * to crawlers.
 */

const WINDOW = 200;
/** Sitemap protocol cap is 50k URLs per file; stay safely under it. */
const MAX_PER_ENTITY = 40_000;

/**
 * Drain a paginated list method. The repository caps `limit` at 200,
 * so enumerating the full dataset (5,000+ drugs at scale) means
 * walking offset windows until `total` is reached.
 */
async function listAll<T>(
  fetchPage: (opts: { limit: number; offset: number }) => Promise<List<T>>,
): Promise<T[]> {
  const first = await fetchPage({ limit: WINDOW, offset: 0 });
  const items = [...first.items];
  const total = Math.min(first.pagination.total, MAX_PER_ENTITY);
  while (items.length < total) {
    const page = await fetchPage({ limit: WINDOW, offset: items.length });
    if (page.items.length === 0) break;
    items.push(...page.items);
  }
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = getRepository();
  const stats = await repo.getStats();
  const lastModified = new Date(stats.updatedAt);

  const [drugs, classes, ingredients, reactions] = await Promise.all([
    listAll((opts) => repo.listDrugs(opts)),
    listAll((opts) => repo.listClasses(opts)),
    listAll((opts) => repo.listIngredients(opts)),
    listAll((opts) => repo.listReactions(opts)),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: absoluteUrl("/drugs"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/classes"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/ingredients"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/brands"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/atc"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/interactions"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/reactions"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/structure-search"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/docs"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/compare"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/changelog"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/reference"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/faq"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/glossary"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/roadmap"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const drugRoutes: MetadataRoute.Sitemap = drugs.map((d) => ({
    url: absoluteUrl(`/drugs/${d.slug}`),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const classRoutes: MetadataRoute.Sitemap = classes.map((c) => ({
    url: absoluteUrl(`/classes/${c.slug}`),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const ingredientRoutes: MetadataRoute.Sitemap = ingredients.map((i) => ({
    url: absoluteUrl(`/ingredients/${i.slug}`),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const reactionRoutes: MetadataRoute.Sitemap = reactions.map((r) => ({
    url: absoluteUrl(`/reactions/${r.slug}`),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...drugRoutes,
    ...classRoutes,
    ...ingredientRoutes,
    ...reactionRoutes,
  ];
}
