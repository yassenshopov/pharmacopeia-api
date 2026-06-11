import { z } from "zod";

/**
 * Outbound webhooks: consumers register an HTTPS endpoint and receive
 * signed POSTs when drug records change, so downstream caches can
 * invalidate instead of polling `/changelog`.
 *
 * Delivery contract:
 *  - Body is the JSON-serialised {@link WebhookEventPayload}.
 *  - `X-Pharmacopeia-Event`     : the event name.
 *  - `X-Pharmacopeia-Delivery`  : unique delivery id (idempotency key).
 *  - `X-Pharmacopeia-Signature` : `t=<unix-seconds>,v1=<hex>` where
 *    `v1 = HMAC-SHA256(secret, "<t>.<raw-body>")`. Verify the
 *    signature and reject stale timestamps to authenticate deliveries.
 */

export const WebhookEventNameSchema = z.enum([
  "drug.created",
  "drug.updated",
  "drug.deleted",
  "dataset.refreshed",
]);
export type WebhookEventName = z.infer<typeof WebhookEventNameSchema>;

export const WEBHOOK_EVENT_NAMES = WebhookEventNameSchema.options;

/** A drug-level change carried inside an event payload. */
export const WebhookDrugChangeSchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  /** Provenance hash after the change (absent for deletions). */
  sourceHash: z.string().optional(),
  /** Which extracted sections changed (updates only). */
  changedSections: z.array(z.string()).optional(),
});
export type WebhookDrugChange = z.infer<typeof WebhookDrugChangeSchema>;

export const WebhookEventPayloadSchema = z.object({
  /** Unique event id (`evt_...`). */
  id: z.string(),
  event: WebhookEventNameSchema,
  timestamp: z.string(),
  /** Dataset snapshot version after the change. */
  datasetVersion: z.string().optional(),
  /** Per-drug changes; absent on `dataset.refreshed`. */
  drugs: z.array(WebhookDrugChangeSchema).optional(),
  /** Roll-up counts, always present on `dataset.refreshed`. */
  summary: z
    .object({
      created: z.number().int().nonnegative(),
      updated: z.number().int().nonnegative(),
      deleted: z.number().int().nonnegative(),
    })
    .optional(),
});
export type WebhookEventPayload = z.infer<typeof WebhookEventPayloadSchema>;

/** Public shape of a registered endpoint. `secret` is never included. */
export const WebhookEndpointSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(WebhookEventNameSchema),
  active: z.boolean(),
  createdAt: z.string(),
  /** Consecutive delivery failures; endpoint auto-disables at 25. */
  failureCount: z.number().int().nonnegative(),
  lastStatus: z.number().int().optional(),
  lastDeliveryAt: z.string().optional(),
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookCreateRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), {
      message: "Webhook URLs must be https (http allowed for localhost only)",
    }),
  /** Defaults to every event. */
  events: z
    .array(WebhookEventNameSchema)
    .min(1)
    .default([...WebhookEventNameSchema.options]),
});
export type WebhookCreateRequest = z.infer<typeof WebhookCreateRequestSchema>;

/**
 * Creation response — the only time the signing `secret` is returned.
 * Store it; deliveries are HMAC-signed with it.
 */
export const WebhookEndpointCreatedSchema = WebhookEndpointSchema.extend({
  secret: z.string(),
});
export type WebhookEndpointCreated = z.infer<
  typeof WebhookEndpointCreatedSchema
>;

export const WebhooksListResponseSchema = z.object({
  endpoints: z.array(WebhookEndpointSchema),
  total: z.number().int().nonnegative(),
});
export type WebhooksListResponse = z.infer<typeof WebhooksListResponseSchema>;

export const WebhookDeleteResponseSchema = z.object({
  deleted: z.literal(true),
  id: z.string(),
});
export type WebhookDeleteResponse = z.infer<typeof WebhookDeleteResponseSchema>;
