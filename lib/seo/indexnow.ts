import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

/**
 * IndexNow submission.
 *
 * IndexNow (Bing, Yandex, and friends) lets a site *push* changed URLs
 * to search engines instead of waiting to be crawled — which matters a
 * lot for a dataset of thousands of pages that change on a refresh
 * schedule. Activation is a single env var, `INDEXNOW_KEY`; without it
 * every call is a no-op so local dev and key-less deployments are
 * unaffected.
 *
 * The key is also served as a verification file at
 * `/indexnow-key.txt` (see `app/indexnow-key.txt/route.ts`), and we pass
 * its `keyLocation` explicitly so the file name need not equal the key.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";
/** IndexNow accepts at most 10,000 URLs per request. */
const MAX_BATCH = 10_000;

export function indexNowKey(): string | undefined {
  return process.env.INDEXNOW_KEY?.trim() || undefined;
}

function host(): string {
  return new URL(SITE_URL).host;
}

/**
 * Submit absolute or site-relative URLs to IndexNow. Best-effort: any
 * network or upstream error is swallowed and reported in the return
 * value rather than thrown, so a refresh job never fails because a ping
 * failed. Returns `{ submitted: 0, skipped: true }` when no key is set.
 */
export async function submitToIndexNow(
  urls: string[],
): Promise<{ submitted: number; skipped: boolean; ok: boolean }> {
  const key = indexNowKey();
  if (!key) return { submitted: 0, skipped: true, ok: true };

  const urlList = [
    ...new Set(urls.map((u) => absoluteUrl(u))),
  ].slice(0, MAX_BATCH);
  if (urlList.length === 0) return { submitted: 0, skipped: false, ok: true };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: host(),
        key,
        keyLocation: absoluteUrl("/indexnow-key.txt"),
        urlList,
      }),
    });
    return { submitted: urlList.length, skipped: false, ok: res.ok };
  } catch {
    return { submitted: urlList.length, skipped: false, ok: false };
  }
}
