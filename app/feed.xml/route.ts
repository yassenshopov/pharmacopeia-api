import { getRepository } from "@/lib/data/repository";
import { toRfc822, xmlEscape } from "@/lib/feed/xml";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";

/**
 * Public RSS 2.0 "what's new" feed.
 *
 * The feed reads straight from the repository's changelog method, so
 * adding an entry under `lib/data/seed/changelog.ts` is enough to make
 * it appear here, in `/feed.json`, and on `/changelog`. Cached at the
 * edge for an hour to keep the route cheap under polling.
 */

export const dynamic = "force-static";
export const revalidate = 3600;

const FEED_TITLE = `${SITE_NAME} · what's new`;
const FEED_DESCRIPTION = `Recent record changes to the pharmacopeia dataset and API. ${SITE_DESCRIPTION}`;
const FEED_LANGUAGE = "en-us";

export async function GET(): Promise<Response> {
  const entries = await getRepository().listChangelog({ limit: 50 });
  const lastBuildDate =
    entries.length > 0 ? toRfc822(entries[0].timestamp) : new Date().toUTCString();

  const items = entries
    .map((entry) => {
      const link = absoluteUrl(entry.url);
      const categories = entry.tags
        .map((t) => `      <category>${xmlEscape(t)}</category>`)
        .join("\n");
      return `    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="false">${xmlEscape(`pharmacopeia:${entry.id}`)}</guid>
      <pubDate>${toRfc822(entry.timestamp)}</pubDate>
      <description>${xmlEscape(entry.summary)}</description>${categories ? `\n${categories}` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(FEED_TITLE)}</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <atom:link href="${xmlEscape(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>${FEED_LANGUAGE}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>pharmacopeia</generator>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
