import type { MetadataRoute } from "next";
import { buildComparisonPairs } from "@/lib/data/comparisons";
import type { List } from "@/lib/data/repository";
import { getRepository } from "@/lib/data/repository";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Sharded sitemap.
 *
 * The dataset is pulled straight from the repository, so adding a drug,
 * class, condition, or comparison automatically surfaces it to crawlers.
 * At the 5,000+ drug scale the URL set blows past what a single sitemap
 * file should carry, so we emit a sitemap *index* (`/sitemap.xml`) over
 * per-shard files (`/sitemap/{id}.xml`) via `generateSitemaps`. Shard 0
 * is the hand-maintained core plus the smaller entity sets; drugs and
 * the drug-vs-drug comparison pages get their own chunked shards.
 */

const WINDOW = 200;
/** Stay well under the 50k-URL-per-file sitemap protocol cap. */
const URLS_PER_SHARD = 10_000;
/** Sitemap protocol cap is 50k URLs per file; stay safely under it. */
const MAX_PER_ENTITY = 40_000;

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

interface SitemapData {
  lastModified: Date;
  drugSlugs: string[];
  classSlugs: string[];
  ingredientSlugs: string[];
  reactionSlugs: string[];
  conditionSlugs: string[];
  pairSlugs: string[];
}

/**
 * Module-level memo so the (potentially large) dataset enumeration runs
 * once per worker process and is shared across `generateSitemaps` and
 * every per-shard `sitemap` call — instead of re-draining the repository
 * once per shard, which over a remote database is the difference between
 * one pass and N. The promise is cached, not the value, so concurrent
 * shard renders coalesce onto a single in-flight load.
 */
let sitemapDataPromise: Promise<SitemapData> | null = null;

function loadSitemapData(): Promise<SitemapData> {
  if (!sitemapDataPromise) {
    sitemapDataPromise = (async (): Promise<SitemapData> => {
      const repo = getRepository();
      const stats = await repo.getStats();

      const [drugs, classes, ingredients, reactions, conditions] =
        await Promise.all([
          listAll((opts) => repo.listDrugs(opts)),
          listAll((opts) => repo.listClasses(opts)),
          listAll((opts) => repo.listIngredients(opts)),
          listAll((opts) => repo.listReactions(opts)),
          listAll((opts) => repo.listConditions(opts)),
        ]);

      return {
        lastModified: new Date(stats.updatedAt),
        drugSlugs: drugs.map((d) => d.slug),
        classSlugs: classes.map((c) => c.slug),
        ingredientSlugs: ingredients.map((i) => i.slug),
        reactionSlugs: reactions.map((r) => r.slug),
        conditionSlugs: conditions.map((c) => c.slug),
        pairSlugs: buildComparisonPairs(drugs).map((p) => p.slug),
      };
    })();
  }
  return sitemapDataPromise;
}

function chunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / URLS_PER_SHARD));
}

interface ShardPlan {
  drugShards: number;
  pairShards: number;
}

function plan(data: SitemapData): ShardPlan {
  return {
    drugShards: chunkCount(data.drugSlugs.length),
    pairShards: chunkCount(data.pairSlugs.length),
  };
}

export async function generateSitemaps(): Promise<{ id: number }[]> {
  const data = await loadSitemapData();
  const { drugShards, pairShards } = plan(data);
  // id 0: core + small entities. 1..drugShards: drug chunks.
  // next pairShards: comparison chunks.
  const total = 1 + drugShards + pairShards;
  return Array.from({ length: total }, (_, id) => ({ id }));
}

function coreShard(data: SitemapData): MetadataRoute.Sitemap {
  const { lastModified } = data;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: absoluteUrl("/drugs"), lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/classes"), lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/ingredients"), lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/brands"), lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/atc"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/moa"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/interactions"), lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/reactions"), lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/conditions"), lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/structure-search"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/compare"), lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/docs"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/reference"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/methodology"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/changelog"), lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/data"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/faq"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/glossary"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/roadmap"), lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];

  const entityRoutes: MetadataRoute.Sitemap = [
    ...data.classSlugs.map((slug) => ({
      url: absoluteUrl(`/classes/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...data.ingredientSlugs.map((slug) => ({
      url: absoluteUrl(`/ingredients/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...data.reactionSlugs.map((slug) => ({
      url: absoluteUrl(`/reactions/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...data.conditionSlugs.map((slug) => ({
      url: absoluteUrl(`/conditions/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  return [...staticRoutes, ...entityRoutes];
}

function sliceShard<T>(items: T[], shardIndex: number): T[] {
  const start = shardIndex * URLS_PER_SHARD;
  return items.slice(start, start + URLS_PER_SHARD);
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const data = await loadSitemapData();
  const { drugShards } = plan(data);

  if (id === 0) return coreShard(data);

  if (id <= drugShards) {
    const slugs = sliceShard(data.drugSlugs, id - 1);
    return slugs.map((slug) => ({
      url: absoluteUrl(`/drugs/${slug}`),
      lastModified: data.lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  }

  const pairShardIndex = id - 1 - drugShards;
  const slugs = sliceShard(data.pairSlugs, pairShardIndex);
  return slugs.map((slug) => ({
    url: absoluteUrl(`/compare/${slug}`),
    lastModified: data.lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
}
