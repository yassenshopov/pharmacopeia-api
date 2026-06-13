import { indexNowKey } from "@/lib/seo/indexnow";

/**
 * /indexnow-key.txt
 *
 * IndexNow ownership-verification file. Search engines fetch this and
 * check that its body equals the key we sign submissions with. Served
 * from `INDEXNOW_KEY` so the key never lives in source; returns 404 when
 * the feature is not configured.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = indexNowKey();
  if (!key) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
