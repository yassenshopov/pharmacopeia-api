import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  newDeliveryId,
  newEventId,
  newWebhookSecret,
  signWebhookBody,
} from "@/lib/webhooks/dispatch";

describe("webhook signing", () => {
  it("produces the documented t=<ts>,v1=<hex> format", () => {
    const sig = signWebhookBody("whsec_test", '{"a":1}', 1_700_000_000);
    expect(sig).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it("is verifiable with standard Stripe-style HMAC verification", () => {
    const secret = "whsec_test";
    const body = '{"event":"drug.updated"}';
    const ts = 1_700_000_000;
    const sig = signWebhookBody(secret, body, ts);

    // What a consumer's verification middleware would compute.
    const [tPart, v1Part] = sig.split(",");
    const t = Number(tPart.slice(2));
    const expected = createHmac("sha256", secret)
      .update(`${t}.${body}`, "utf8")
      .digest("hex");
    expect(v1Part).toBe(`v1=${expected}`);
  });

  it("changes when the body, secret, or timestamp changes", () => {
    const base = signWebhookBody("s1", "body", 1000);
    expect(signWebhookBody("s1", "body2", 1000)).not.toBe(base);
    expect(signWebhookBody("s2", "body", 1000)).not.toBe(base);
    expect(signWebhookBody("s1", "body", 1001)).not.toBe(base);
  });
});

describe("id and secret generation", () => {
  it("uses stable prefixes and url-safe characters", () => {
    expect(newWebhookSecret()).toMatch(/^whsec_[A-Za-z0-9_-]{32}$/);
    expect(newEventId()).toMatch(/^evt_[A-Za-z0-9_-]{16}$/);
    expect(newDeliveryId()).toMatch(/^whd_[A-Za-z0-9_-]{16}$/);
  });

  it("never repeats", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newEventId()));
    expect(ids.size).toBe(100);
  });
});
