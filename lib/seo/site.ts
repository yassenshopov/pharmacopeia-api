/**
 * Single source of truth for absolute URL construction across the SEO
 * surface (metadata, JSON-LD, sitemap, robots, manifest, OG images).
 *
 * `NEXT_PUBLIC_SITE_URL` is read at module-load time. Falls back to the
 * production domain so server-rendered HTML always carries a real
 * absolute URL — anchor tags and JSON-LD don't tolerate undefined.
 */

const DEFAULT_SITE_URL = "https://pharmacopeia.dev";

function normalize(input: string | undefined): string {
  const raw = (input ?? DEFAULT_SITE_URL).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export const SITE_URL = normalize(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_NAME = "pharmacopeia";

export const SITE_DESCRIPTION =
  "Drugs, classes, interactions, and indications — structured, versioned, free. A developer-first reference layer for the world's pharmacopeia.";

export function absoluteUrl(path: string = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function ogImageUrl(params: {
  title: string;
  subtitle?: string;
}): string {
  const search = new URLSearchParams();
  search.set("title", params.title);
  if (params.subtitle) search.set("subtitle", params.subtitle);
  return `${SITE_URL}/og?${search.toString()}`;
}
