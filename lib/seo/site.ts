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

/**
 * Canonical off-site identities for the project, used to wire the
 * `Organization` entity's `sameAs` graph and the footer. Keeping them
 * here (not inlined in JSON-LD) means the entity graph and the visible
 * links can never drift. Override the repo URL with
 * `NEXT_PUBLIC_GITHUB_URL` once the public repository is named.
 */
export const SITE_GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL?.trim() ||
  "https://github.com/yassenshopov";

export const SITE_SAME_AS: readonly string[] = [
  SITE_GITHUB_URL,
  "https://linkedin.com/in/yassenshopov",
];

/**
 * Editorial owner of the dataset. Surfaced as the `author` /
 * `reviewedBy` entity on medical pages so the YMYL trust signals are
 * machine-readable. This is a data-curation stance, not a clinical
 * endorsement — the project never gives medical advice.
 */
export const SITE_AUTHOR_NAME = "pharmacopeia editorial team";

/**
 * Google Analytics 4 measurement id (`G-XXXXXXXXXX`), read from the
 * environment. When unset (local dev, key-less deployments) the GA4
 * script is simply not rendered, so no analytics calls fire.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID?.trim() || undefined;

/**
 * Search-engine ownership verification tokens, read from the
 * environment so they never live in source. Wired into the root
 * `metadata.verification` block. Set the corresponding env vars in the
 * deployment to activate Google Search Console / Bing Webmaster Tools.
 */
export const SITE_VERIFICATION = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined,
  bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim() || undefined,
  yandex: process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim() || undefined,
} as const;

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
