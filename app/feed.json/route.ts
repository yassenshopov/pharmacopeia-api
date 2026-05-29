import { getRepository } from "@/lib/data/repository";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";

/**
 * Public JSON Feed 1.1 "what's new" feed.
 *
 * Mirrors the RSS feed at `/feed.xml`. Both read from the same
 * `listChangelog()` repository method so they can never disagree on
 * which entries they advertise.
 *
 * Spec: https://www.jsonfeed.org/version/1.1/
 */

export const dynamic = "force-static";
export const revalidate = 3600;

interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  content_text: string;
  date_published: string;
  tags?: string[];
  _pharmacopeia?: {
    kind: string;
    action: string;
    entitySlug?: string;
    sources: string[];
  };
}

interface JsonFeed {
  version: "https://jsonfeed.org/version/1.1";
  title: string;
  description: string;
  home_page_url: string;
  feed_url: string;
  language: string;
  items: JsonFeedItem[];
}

export async function GET(): Promise<Response> {
  const entries = await getRepository().listChangelog({ limit: 50 });

  const items: JsonFeedItem[] = entries.map((entry) => ({
    id: `pharmacopeia:${entry.id}`,
    url: absoluteUrl(entry.url),
    title: entry.title,
    content_text: entry.summary,
    date_published: entry.timestamp,
    tags: entry.tags.length > 0 ? entry.tags : undefined,
    _pharmacopeia: {
      kind: entry.kind,
      action: entry.action,
      entitySlug: entry.entitySlug,
      sources: entry.sources,
    },
  }));

  const feed: JsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE_NAME} · what's new`,
    description: `Recent record changes to the pharmacopeia dataset and API. ${SITE_DESCRIPTION}`,
    home_page_url: SITE_URL,
    feed_url: absoluteUrl("/feed.json"),
    language: "en-us",
    items,
  };

  return new Response(JSON.stringify(feed), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
