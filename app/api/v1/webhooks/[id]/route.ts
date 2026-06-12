import { notConfigured, notFound, ok } from "@/lib/api/response";
import { guardApiKey, withRateLimitHeaders } from "@/lib/auth/guard";
import { getRepositoryKind } from "@/lib/data/repository";
import { getPrismaClient } from "@/lib/db/client";
import type { WebhookDeleteResponse } from "@/lib/schemas";

const DB_REQUIRED =
  "Webhooks require the database backend; this deployment is running on the static seed dataset";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiKey(request);
  if (!guard.ok) return guard.response;
  if (getRepositoryKind() !== "supabase") return notConfigured(DB_REQUIRED);

  const { id } = await params;
  const db = getPrismaClient();
  // Scope the lookup to the calling key so one consumer can never
  // delete (or probe for) another consumer's endpoints.
  const row = await db.webhookEndpoint.findFirst({
    where: { id, apiKeyId: guard.auth.keyId },
    select: { id: true },
  });
  if (!row) return notFound("No webhook endpoint with this id");

  await db.webhookEndpoint.delete({ where: { id: row.id } });
  return withRateLimitHeaders(
    ok(
      { deleted: true, id: row.id } satisfies WebhookDeleteResponse,
      { cacheControl: "no-store" },
    ),
    guard.headers,
  );
}
