import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { buildSchemaBundle } from "@/lib/sdk/registry";
import { buildOpenApi } from "@/lib/sdk/openapi";
import { SITE_URL } from "@/lib/seo/site";

/**
 * GET /api/v1/openapi.json
 *
 * Live OpenAPI 3.1 document, generated from the same Zod schemas the
 * handlers validate against. Keeping the live route and the bundled
 * `sdk/openapi.json` on the same builder (`lib/sdk/openapi.ts`) means
 * the spec the SDKs are generated from and the spec served at this URL
 * cannot drift.
 *
 * CORS is permissive (`*`) so the spec can be loaded from third-party
 * documentation renderers (Scalar, Swagger UI, Redoc, ...) without a
 * proxy.
 */

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

const DOC = buildOpenApi(buildSchemaBundle(), { serverUrl: SITE_URL });
const BODY = `${JSON.stringify(DOC, null, 2)}\n`;
const ETAG = `"${createHash("sha1").update(BODY).digest("hex").slice(0, 16)}"`;

export function GET(request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && (ifNoneMatch.trim() === "*" || ifNoneMatch.includes(ETAG))) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": CACHE,
        ETag: ETAG,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      "Cache-Control": CACHE,
      "Content-Type": "application/json; charset=utf-8",
      ETag: ETAG,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
