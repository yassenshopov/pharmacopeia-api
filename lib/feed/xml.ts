/**
 * XML-escape helpers for the public RSS feed.
 *
 * Hand-rolled because the feed is tiny (≤200 entries, one-line entries
 * each) and pulling in a feed library would dwarf the actual payload.
 */
const XML_ESCAPE_RE = /[<>&'"]/g;
const XML_ESCAPE_MAP: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;",
};

export function xmlEscape(value: string): string {
  return value.replace(XML_ESCAPE_RE, (ch) => XML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * Format an ISO timestamp as RFC-822, which the RSS 2.0 spec requires
 * for `<pubDate>` and `<lastBuildDate>`. Native `toUTCString()` already
 * emits RFC-822 — we just guarantee a valid date.
 */
export function toRfc822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}
