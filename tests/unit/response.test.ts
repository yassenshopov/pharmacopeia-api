import { describe, expect, it } from "vitest";
import {
  invalid,
  notFound,
  ok,
  parseLimitOffset,
  rateLimited,
  unauthorized,
} from "@/lib/api/response";
import { ApiErrorSchema } from "@/lib/schemas";

describe("ok()", () => {
  it("sets the default cache policy, ETag, Vary, and noindex headers", async () => {
    const res = ok({ hello: "world" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(res.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{16}"$/);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("computes a deterministic ETag per body", () => {
    const a = ok({ n: 1 }).headers.get("ETag");
    const b = ok({ n: 1 }).headers.get("ETag");
    const c = ok({ n: 2 }).headers.get("ETag");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("short-circuits to 304 when If-None-Match matches", async () => {
    const etag = ok({ n: 1 }).headers.get("ETag")!;
    const request = new Request("https://example.com/api", {
      headers: { "If-None-Match": etag },
    });
    const res = ok({ n: 1 }, { request });
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe(etag);
    expect(await res.text()).toBe("");
  });

  it("matches against a comma-separated If-None-Match list and *", () => {
    const etag = ok({ n: 1 }).headers.get("ETag")!;
    const listReq = new Request("https://example.com/api", {
      headers: { "If-None-Match": `"nope", ${etag}` },
    });
    expect(ok({ n: 1 }, { request: listReq }).status).toBe(304);

    const starReq = new Request("https://example.com/api", {
      headers: { "If-None-Match": "*" },
    });
    expect(ok({ n: 1 }, { request: starReq }).status).toBe(304);
  });

  it("serves 200 when If-None-Match does not match", () => {
    const request = new Request("https://example.com/api", {
      headers: { "If-None-Match": '"0000000000000000"' },
    });
    expect(ok({ n: 1 }, { request }).status).toBe(200);
  });

  it("honours a custom cache-control", () => {
    const res = ok({}, { cacheControl: "public, s-maxage=60" });
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });
});

describe("error helpers", () => {
  it("notFound returns a schema-valid 404 envelope", async () => {
    const res = notFound("Drug 'x' not found");
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("invalid returns a schema-valid 400 envelope with details", async () => {
    const res = invalid("Bad input", [{ path: ["slugs"], message: "nope" }]);
    expect(res.status).toBe(400);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.details).toEqual([{ path: ["slugs"], message: "nope" }]);
  });

  it("unauthorized returns 401 with a WWW-Authenticate challenge", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer realm="pharmacopeia"',
    );
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("unauthorized");
  });

  it("rateLimited returns 429 with Retry-After and custom headers", async () => {
    const res = rateLimited("Slow down", {
      retryAfterSeconds: 30,
      headers: { "X-RateLimit-Limit": "60" },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("rate_limited");
  });
});

describe("parseLimitOffset", () => {
  const url = (qs: string) => new URL(`https://example.com/api?${qs}`);

  it("defaults to limit 50, offset 0", () => {
    expect(parseLimitOffset(url(""))).toEqual({ limit: 50, offset: 0 });
  });

  it("clamps limit to 1..200 and offset to >= 0", () => {
    expect(parseLimitOffset(url("limit=500"))).toEqual({
      limit: 200,
      offset: 0,
    });
    expect(parseLimitOffset(url("limit=0"))).toEqual({ limit: 50, offset: 0 });
    expect(parseLimitOffset(url("limit=-5&offset=-10"))).toEqual({
      limit: 1,
      offset: 0,
    });
  });

  it("falls back to defaults on garbage input", () => {
    expect(parseLimitOffset(url("limit=abc&offset=xyz"))).toEqual({
      limit: 50,
      offset: 0,
    });
  });
});
