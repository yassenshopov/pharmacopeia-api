import { invalid, notConfigured, ok, unauthorized } from "@/lib/api/response";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { getRepositoryKind } from "@/lib/data/repository";
import { getPrismaClient } from "@/lib/db/client";
import { newWebhookSecret } from "@/lib/webhooks/dispatch";
import {
  WebhookCreateRequestSchema,
  type WebhookEndpoint,
  type WebhookEndpointCreated,
  type WebhookEventName,
  type WebhooksListResponse,
} from "@/lib/schemas";

/**
 * Webhook endpoint management. Key-gated: endpoints are scoped to the
 * API key that registered them (env-var keys share one anonymous
 * scope). Requires the Postgres backend — endpoint registrations and
 * delivery logs live in the database.
 */

const DB_REQUIRED =
  "Webhooks require the database backend; this deployment is running on the static seed dataset";

type EndpointRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  failureCount: number;
  lastStatus: number | null;
  lastDeliveryAt: Date | null;
};

function toPublicEndpoint(row: EndpointRow): WebhookEndpoint {
  return {
    id: row.id,
    url: row.url,
    events: row.events as WebhookEventName[],
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    failureCount: row.failureCount,
    ...(row.lastStatus !== null ? { lastStatus: row.lastStatus } : {}),
    ...(row.lastDeliveryAt
      ? { lastDeliveryAt: row.lastDeliveryAt.toISOString() }
      : {}),
  };
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();
  if (getRepositoryKind() !== "supabase") return notConfigured(DB_REQUIRED);

  const rows = await getPrismaClient().webhookEndpoint.findMany({
    where: { apiKeyId: auth.keyId },
    orderBy: { createdAt: "asc" },
  });
  return ok(
    {
      endpoints: rows.map(toPublicEndpoint),
      total: rows.length,
    } satisfies WebhooksListResponse,
    { cacheControl: "no-store" },
  );
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();
  if (getRepositoryKind() !== "supabase") return notConfigured(DB_REQUIRED);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid("Request body must be JSON");
  }
  const parsed = WebhookCreateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid(
      "Invalid request body",
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    );
  }

  const secret = newWebhookSecret();
  const row = await getPrismaClient().webhookEndpoint.create({
    data: {
      apiKeyId: auth.keyId,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
    },
  });
  return ok(
    {
      ...toPublicEndpoint(row),
      secret,
    } satisfies WebhookEndpointCreated,
    { status: 201, cacheControl: "no-store" },
  );
}
