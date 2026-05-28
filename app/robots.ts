import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

/**
 * API routes ship JSON for programmatic consumption — keep them out
 * of search indexes. The marketing surface (drugs, classes, docs)
 * stays fully crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
