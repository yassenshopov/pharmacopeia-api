import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * The sitemap is pulled directly from the repository so adding a drug
 * or class to `lib/data/seed/` (or, later, Supabase) automatically
 * surfaces it to crawlers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = getRepository();
  const stats = await repo.getStats();
  const lastModified = new Date(stats.updatedAt);

  const [{ items: drugs }, { items: classes }, { items: ingredients }] =
    await Promise.all([
      repo.listDrugs({ limit: 200 }),
      repo.listClasses({ limit: 200 }),
      repo.listIngredients({ limit: 200 }),
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

  return [
    ...staticRoutes,
    ...drugRoutes,
    ...classRoutes,
    ...ingredientRoutes,
  ];
}
