import type { JsonSchemaObject, SchemaBundle } from "@/lib/sdk/registry";
import {
  API_BASE_PATH,
  DEFAULT_BASE_URL,
  OPERATIONS,
  type Operation,
} from "@/lib/sdk/manifest";
import { GEN_HEADER_TS, isObjectNode, isOptional, refName } from "./util";

/** Map a JSON Schema node to a TypeScript type expression. */
function tsType(node: JsonSchemaObject): string {
  if (node.$ref) return refName(node.$ref);
  if (node.const !== undefined) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (node.anyOf) return node.anyOf.map(tsType).join(" | ");

  const type = node.type;
  if (Array.isArray(type)) {
    return type.map((t) => tsType({ ...node, type: t })).join(" | ");
  }
  switch (type) {
    case "array": {
      const inner = node.items ? tsType(node.items) : "unknown";
      return inner.includes(" ") ? `Array<${inner}>` : `${inner}[]`;
    }
    case "object":
      if (node.properties) return inlineObject(node);
      return "Record<string, unknown>";
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

function inlineObject(node: JsonSchemaObject): string {
  const props = Object.entries(node.properties ?? {}).map(([key, child]) => {
    const opt = isOptional(node, key) ? "?" : "";
    return `${key}${opt}: ${tsType(child)}`;
  });
  return `{ ${props.join("; ")} }`;
}

function emitNamedType(name: string, node: JsonSchemaObject): string {
  if (isObjectNode(node)) {
    const lines = Object.entries(node.properties ?? {}).map(([key, child]) => {
      const opt = isOptional(node, key) ? "?" : "";
      const doc = child.description ? `  /** ${child.description} */\n` : "";
      return `${doc}  ${key}${opt}: ${tsType(child)};`;
    });
    return `export interface ${name} {\n${lines.join("\n")}\n}`;
  }
  return `export type ${name} = ${tsType(node)};`;
}

export function emitTypes(bundle: SchemaBundle): string {
  const blocks = bundle.order.map((name) =>
    emitNamedType(name, bundle.defs[name]),
  );
  return `${GEN_HEADER_TS}\n${blocks.join("\n\n")}\n`;
}

function pathExpr(op: Operation): string {
  let path = op.path;
  for (const p of op.pathParams ?? []) {
    path = path.replace(`{${p}}`, `\${encodeURIComponent(${p})}`);
  }
  return `\`${path}\``;
}

function queryType(op: Operation): string | null {
  if (!op.queryParams || op.queryParams.length === 0) return null;
  const props = op.queryParams.map((q) => {
    const opt = q.required ? "" : "?";
    return `${q.name}${opt}: ${q.type}`;
  });
  return `{ ${props.join("; ")} }`;
}

function emitMethod(op: Operation): string {
  const args: string[] = [];
  for (const p of op.pathParams ?? []) args.push(`${p}: string`);
  if (op.requestSchema) args.push(`body: ${op.requestSchema}`);
  const qt = queryType(op);
  const queryRequired = op.queryParams?.some((q) => q.required);
  if (qt) args.push(queryRequired ? `query: ${qt}` : `query: ${qt} = {}`);

  const callOpts: string[] = [];
  if (qt) callOpts.push("query");
  if (op.requestSchema) callOpts.push("body");
  const optsArg = callOpts.length ? `{ ${callOpts.join(", ")} }` : "{}";

  const doc = `  /** ${op.summary} */`;
  return `${doc}\n  ${op.name}(${args.join(", ")}): Promise<${op.responseSchema}> {\n    return this.request<${op.responseSchema}>("${op.method}", ${pathExpr(op)}, ${optsArg});\n  }`;
}

export function emitClient(): string {
  const typeImports = Array.from(
    new Set(
      OPERATIONS.flatMap((op) =>
        [op.responseSchema, op.requestSchema].filter(Boolean) as string[],
      ),
    ),
  ).sort();

  const methods = OPERATIONS.map(emitMethod).join("\n\n");

  return `${GEN_HEADER_TS}
import type {
${typeImports.map((t) => `  ${t},`).join("\n")}
} from "./types";

/** Base URL of the pharmacopeia API (origin + \`${API_BASE_PATH}\`). */
export const DEFAULT_BASE_URL = "${DEFAULT_BASE_URL}";

export interface PharmacopeiaClientOptions {
  /** Override the API base URL. Defaults to \`DEFAULT_BASE_URL\`. */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global \`fetch\`). */
  fetch?: typeof fetch;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
  /** Optional bearer token, sent as \`Authorization: Bearer <apiKey>\`. */
  apiKey?: string;
}

/** Error thrown when the API returns a non-2xx response. */
export class PharmacopeiaError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    init: { code?: string; status: number; details?: unknown },
  ) {
    super(message);
    this.name = "PharmacopeiaError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
  }
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function toQueryString(
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    parts.push(\`\${encodeURIComponent(key)}=\${encodeURIComponent(String(value))}\`);
  }
  return parts.length ? \`?\${parts.join("&")}\` : "";
}

/**
 * Thin, fully-typed client for the pharmacopeia API. Every method returns
 * the same shape the API serves; non-2xx responses throw
 * \`PharmacopeiaError\` carrying the API error \`code\` and \`details\`.
 */
export class PharmacopeiaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: PharmacopeiaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\\/$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        "No fetch implementation found. Pass \`fetch\` via options.",
      );
    }
    this.headers = {
      Accept: "application/json",
      ...(options.apiKey ? { Authorization: \`Bearer \${options.apiKey}\` } : {}),
      ...options.headers,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\${toQueryString(options.query)}\`;
    const headers: Record<string, string> = { ...this.headers };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const res = await this.fetchImpl(url, { method, headers, body });
    if (!res.ok) {
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        payload = undefined;
      }
      const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
      throw new PharmacopeiaError(err?.message ?? res.statusText, {
        code: err?.code,
        status: res.status,
        details: err?.details,
      });
    }
    return (await res.json()) as T;
  }

${methods}
}
`;
}
