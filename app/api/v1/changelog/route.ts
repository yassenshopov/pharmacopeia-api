import { invalid, ok, parseLimitOffset } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ChangelogResponse } from "@/lib/schemas";

/**
 * Typed mirror of the public RSS / JSON feeds. Same entries, same
 * ordering, JSON-typed against the same Zod schemas the SDK uses.
 * Lets consumers who already speak the typed SDK pull "what's new"
 * without parsing RSS or JSON Feed.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { limit } = parseLimitOffset(url);

  const since = url.searchParams.get("since") ?? undefined;
  if (since !== undefined && Number.isNaN(Date.parse(since))) {
    return invalid("`since` must be an ISO-8601 timestamp.");
  }

  const entries = await getRepository().listChangelog({ limit, since });
  const body: ChangelogResponse = { entries, total: entries.length };
  return ok(body);
}
