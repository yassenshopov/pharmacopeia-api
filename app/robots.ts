import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

/**
 * API routes ship JSON for programmatic consumption — keep them out of
 * search indexes. The marketing surface (drugs, classes, docs) stays
 * fully crawlable. We carve out the OpenAPI document because Scalar and
 * other reference renderers may want to crawl it, and the LLM
 * convention files (`/llms.txt`, `/llms-full.txt`) are explicitly
 * advertised to LLM crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/openapi.json"],
        disallow: ["/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
