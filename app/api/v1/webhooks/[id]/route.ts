import { notConfigured, notFound, ok, unauthorized } from "@/lib/api/response";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { getRepositoryKind } from "@/lib/data/repository";
import { getPrismaClient } from "@/lib/db/client";
import type { WebhookDeleteResponse } from "@/lib/schemas";

const DB_REQUIRED =
  "Webhooks require the database backend; this deployment is running on the static seed dataset";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();
  if (getRepositoryKind() !== "supabase") return notConfigured(DB_REQUIRED);

  const { id } = await params;
  const db = getPrismaClient();
  // Scope the lookup to the calling key so one consumer can never
  // delete (or probe for) another consumer's endpoints.
  const row = await db.webhookEndpoint.findFirst({
    where: { id, apiKeyId: auth.keyId },
    select: { id: true },
  });
  if (!row) return notFound("No webhook endpoint with this id");

  await db.webhookEndpoint.delete({ where: { id: row.id } });
  return ok(
    { deleted: true, id: row.id } satisfies WebhookDeleteResponse,
    { cacheControl: "no-store" },
  );
}
