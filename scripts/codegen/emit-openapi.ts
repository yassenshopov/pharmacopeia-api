import type { JsonSchemaObject, SchemaBundle } from "@/lib/sdk/registry";
import {
  API_BASE_PATH,
  DEFAULT_BASE_URL,
  OPERATIONS,
  type Operation,
} from "@/lib/sdk/manifest";

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

export function emitOpenApi(bundle: SchemaBundle): string {
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

  const origin = DEFAULT_BASE_URL.endsWith(API_BASE_PATH)
    ? DEFAULT_BASE_URL.slice(0, -API_BASE_PATH.length)
    : DEFAULT_BASE_URL;

  const doc = {
    openapi: "3.1.0",
    info: {
      title: "pharmacopeia API",
      version: "v1",
      description:
        "Developer-first reference API for medications. Educational / informational use only.",
    },
    servers: [{ url: origin }],
    paths,
    components: { schemas },
  };

  return `${JSON.stringify(doc, null, 2)}\n`;
}
