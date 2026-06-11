import { createHmac, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { WebhookEventPayload } from "@/lib/schemas";

/**
 * Outbound webhook delivery.
 *
 * Deliveries are signed with the endpoint's `whsec_...` secret:
 * `X-Pharmacopeia-Signature: t=<unix-seconds>,v1=<hex>` where
 * `v1 = HMAC-SHA256(secret, "<t>.<raw-body>")` — same scheme consumers
 * already know from Stripe, so existing verification middleware works
 * unchanged. Every attempt is recorded in `webhook_deliveries`;
 * consecutive failures auto-disable an endpoint at
 * {@link AUTO_DISABLE_AFTER_FAILURES} so dead URLs don't get hammered
 * forever.
 */

export const AUTO_DISABLE_AFTER_FAILURES = 25;
const MAX_ATTEMPTS = 3;
const ATTEMPT_BACKOFF_MS = 500;
const DELIVERY_TIMEOUT_MS = 10_000;

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function newEventId(): string {
  return `evt_${randomBytes(12).toString("base64url")}`;
}

export function newDeliveryId(): string {
  return `whd_${randomBytes(12).toString("base64url")}`;
}

export function signWebhookBody(
  secret: string,
  body: string,
  timestampSeconds: number,
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${body}`, "utf8")
    .digest("hex");
  return `t=${timestampSeconds},v1=${v1}`;
}

interface AttemptResult {
  ok: boolean;
  status?: number;
  attempts: number;
}

async function deliverOnce(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

async function deliverWithRetries(
  endpointUrl: string,
  secret: string,
  event: string,
  body: string,
): Promise<AttemptResult> {
  const deliveryId = newDeliveryId();
  let last: { ok: boolean; status?: number } = { ok: false };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const headers = {
      "Content-Type": "application/json",
      "X-Pharmacopeia-Event": event,
      "X-Pharmacopeia-Delivery": deliveryId,
      "X-Pharmacopeia-Signature": signWebhookBody(
        secret,
        body,
        Math.floor(Date.now() / 1000),
      ),
    };
    last = await deliverOnce(endpointUrl, headers, body);
    // 4xx is the receiver rejecting the delivery — retrying won't help.
    if (last.ok || (last.status !== undefined && last.status < 500)) {
      return { ...last, attempts: attempt };
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, ATTEMPT_BACKOFF_MS * attempt));
    }
  }
  return { ...last, attempts: MAX_ATTEMPTS };
}

/**
 * Deliver one event to every active endpoint subscribed to it.
 * Returns the number of endpoints that acknowledged with a 2xx.
 */
export async function dispatchWebhookEvent(
  db: PrismaClient,
  payload: WebhookEventPayload,
): Promise<number> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { active: true, events: { has: payload.event } },
  });
  if (endpoints.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const result = await deliverWithRetries(
        endpoint.url,
        endpoint.secret,
        payload.event,
        body,
      );
      if (result.ok) delivered++;

      const failureCount = result.ok ? 0 : endpoint.failureCount + 1;
      await db.$transaction([
        db.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            event: payload.event,
            payload: JSON.parse(body),
            ok: result.ok,
            status: result.status ?? null,
            attempts: result.attempts,
          },
        }),
        db.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            failureCount,
            lastStatus: result.status ?? null,
            lastDeliveryAt: new Date(),
            ...(failureCount >= AUTO_DISABLE_AFTER_FAILURES
              ? { active: false }
              : {}),
          },
        }),
      ]);
    }),
  );

  return delivered;
}
