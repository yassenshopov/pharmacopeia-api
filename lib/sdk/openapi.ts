import type { JsonSchemaObject, SchemaBundle } from "./registry";
import {
  API_BASE_PATH,
  API_TAG_GROUPS,
  API_TAGS,
  DEFAULT_BASE_URL,
  OPERATIONS,
  type Operation,
} from "./manifest";

/**
 * Build an OpenAPI 3.1 document from the shared schema registry +
 * operations manifest. Lives under `lib/` (not `scripts/`) so the live
 * `/api/v1/openapi.json` route can import the exact same builder the
 * codegen step uses, guaranteeing the live spec and the bundled
 * `sdk/openapi.json` never drift.
 */

/** Recursively rewrite `#/$defs/X` refs to `#/components/schemas/X`. */
function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") {
        out[key] = value.replace("#/$defs/", "#/components/schemas/");
      } else if (key === "$schema" || key === "$id") {
        continue;
      } else {
        out[key] = rewriteRefs(value);
      }
    }
    return out;
  }
  return node;
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function operationObject(op: Operation) {
  const parameters: Record<string, unknown>[] = [];
  for (const p of op.pathParams ?? []) {
    parameters.push({
      name: p,
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }
  for (const q of op.queryParams ?? []) {
    parameters.push({
      name: q.name,
      in: "query",
      required: q.required ?? false,
      description: q.description,
      schema: { type: q.type === "number" ? "integer" : "string" },
    });
  }

  const responses: Record<string, unknown> = {
    "200": {
      description: "Success",
      content: { "application/json": { schema: ref(op.responseSchema) } },
    },
    "304": {
      description:
        "Not Modified — the resource has not changed since the ETag in `If-None-Match`.",
    },
    "400": {
      description: "Invalid request",
      content: { "application/json": { schema: ref("ApiError") } },
    },
  };
  if (op.pathParams?.length) {
    responses["404"] = {
      description: "Not found",
      content: { "application/json": { schema: ref("ApiError") } },
    };
  }

  const obj: Record<string, unknown> = {
    operationId: op.name,
    summary: op.summary,
    tags: [op.tag],
    responses,
  };
  if (parameters.length) obj.parameters = parameters;
  if (op.requestSchema) {
    obj.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(op.requestSchema) } },
    };
  }
  return obj;
}

export interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: { url: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
  /**
   * Scalar / Redoc extension: groups sidebar tags under higher-level
   * headings. Standards-compliant tooling ignores `x-*` keys, so this
   * is presentation-only.
   */
  "x-tagGroups": { name: string; tags: string[] }[];
}

export function buildOpenApi(
  bundle: SchemaBundle,
  options: { serverUrl?: string } = {},
): OpenApiDocument {
  const schemas: Record<string, unknown> = {};
  for (const name of bundle.order) {
    schemas[name] = rewriteRefs(bundle.defs[name] as JsonSchemaObject);
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const fullPath = `${API_BASE_PATH}${op.path}`;
    paths[fullPath] = paths[fullPath] ?? {};
    paths[fullPath][op.method.toLowerCase()] = operationObject(op);
  }

  const defaultOrigin = DEFAULT_BASE_URL.endsWith(API_BASE_PATH)
    ? DEFAULT_BASE_URL.slice(0, -API_BASE_PATH.length)
    : DEFAULT_BASE_URL;
  const origin = options.serverUrl ?? defaultOrigin;

  return {
    openapi: "3.1.0",
    info: {
      title: "pharmacopeia API",
      version: "v1",
      description:
        "Developer-first reference API for medications. Educational / informational use only.\n\n" +
        "All GET responses are cached at the edge (`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`) " +
        "and ship a strong `ETag`. Clients can revalidate with `If-None-Match` and receive `304 Not Modified` on a hit.",
    },
    servers: [{ url: origin }],
    tags: API_TAGS.map((t) => ({ name: t.name, description: t.description })),
    paths,
    components: { schemas },
    "x-tagGroups": API_TAG_GROUPS.map((g) => ({
      name: g.name,
      tags: [...g.tags],
    })),
  };
}

export function emitOpenApi(bundle: SchemaBundle): string {
  return `${JSON.stringify(buildOpenApi(bundle), null, 2)}\n`;
}
