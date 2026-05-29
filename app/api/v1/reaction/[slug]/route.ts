import { NextResponse } from "next/server";
import { notFound, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import type { ReactionResponse } from "@/lib/schemas";

/**
 * Fetch a single reaction by slug. Alias slugs (American spelling
 * variants) 301-redirect to the canonical URL so search engines treat
 * them as a single resource.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const repo = getRepository();
  const resolved = await repo.resolveReactionSlug(slug);
  if (!resolved) return notFound(`Reaction '${slug}' not found`);

  if (resolved.matched !== resolved.canonical) {
    // Alias hit — 301 to the canonical URL. Same origin as the
    // requested resource; let the platform pick host + protocol.
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(
      `/reaction/${resolved.matched}`,
      `/reaction/${resolved.canonical}`,
    );
    return NextResponse.redirect(url, 301);
  }

  const reaction = await repo.getReaction(resolved.canonical);
  if (!reaction) return notFound(`Reaction '${slug}' not found`);

  const body: ReactionResponse = reaction;
  return ok(body, { request });
}
