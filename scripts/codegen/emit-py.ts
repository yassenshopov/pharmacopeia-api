import type { JsonSchemaObject, SchemaBundle } from "@/lib/sdk/registry";
import {
  DEFAULT_BASE_URL,
  OPERATIONS,
  type Operation,
} from "@/lib/sdk/manifest";
import {
  GEN_HEADER_PY,
  isObjectNode,
  isOptional,
  refName,
  snakeCase,
} from "./util";

function pyLiteral(value: unknown): string {
  return JSON.stringify(value);
}

/** Map a JSON Schema node to a Python type expression. */
function pyType(node: JsonSchemaObject): string {
  if (node.$ref) return refName(node.$ref);
  if (node.const !== undefined) return `Literal[${pyLiteral(node.const)}]`;
  if (node.enum) {
    return `Literal[${node.enum.map(pyLiteral).join(", ")}]`;
  }
  if (node.anyOf) return unionType(node.anyOf);

  const type = node.type;
  if (Array.isArray(type)) {
    return unionType(type.map((t) => ({ ...node, type: t })));
  }
  switch (type) {
    case "array":
      return `List[${node.items ? pyType(node.items) : "Any"}]`;
    case "object":
      return "Dict[str, Any]";
    case "string":
      return "str";
    case "integer":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "null":
      return "None";
    default:
      return "Any";
  }
}

function unionType(nodes: JsonSchemaObject[]): string {
  const hasNull = nodes.some((n) => n.type === "null");
  const rest = nodes.filter((n) => n.type !== "null").map(pyType);
  const inner = rest.length === 1 ? rest[0] : `Union[${rest.join(", ")}]`;
  return hasNull ? `Optional[${inner}]` : inner;
}

function wrapOptional(t: string): string {
  return t.startsWith("Optional[") ? t : `Optional[${t}]`;
}

function emitModel(name: string, node: JsonSchemaObject): string {
  const lines: string[] = [`class ${name}(BaseModel):`];
  lines.push("    model_config = ConfigDict(populate_by_name=True)");
  lines.push("");

  const entries = Object.entries(node.properties ?? {});
  if (entries.length === 0) lines.push("    pass");

  for (const [key, child] of entries) {
    const attr = snakeCase(key);
    const optional = isOptional(node, key);
    const baseType = pyType(child);
    const annotated = optional ? wrapOptional(baseType) : baseType;
    const needsAlias = attr !== key;

    if (child.description) lines.push(`    # ${child.description}`);

    let line: string;
    if (optional && needsAlias) {
      line = `    ${attr}: ${annotated} = Field(default=None, alias="${key}")`;
    } else if (optional) {
      line = `    ${attr}: ${annotated} = None`;
    } else if (needsAlias) {
      line = `    ${attr}: ${annotated} = Field(alias="${key}")`;
    } else {
      line = `    ${attr}: ${annotated}`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function emitModels(bundle: SchemaBundle): string {
  const blocks = bundle.order.map((name) => {
    const node = bundle.defs[name];
    if (isObjectNode(node)) return emitModel(name, node);
    return `${name} = ${pyType(node)}`;
  });

  return `${GEN_HEADER_PY}from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

${blocks.join("\n\n\n")}
`;
}

function pyParamType(t: "string" | "number"): string {
  return t === "number" ? "int" : "str";
}

function emitMethod(op: Operation): string {
  const params: string[] = ["self"];
  for (const p of op.pathParams ?? []) params.push(`${snakeCase(p)}: str`);
  if (op.requestSchema) params.push(`body: ${op.requestSchema}`);

  const sortedQuery = [...(op.queryParams ?? [])].sort((a, b) =>
    a.required === b.required ? 0 : a.required ? -1 : 1,
  );
  if (sortedQuery.length > 0) params.push("*");
  for (const q of sortedQuery) {
    const argName = snakeCase(q.argName ?? q.name);
    const t = pyParamType(q.type);
    params.push(q.required ? `${argName}: ${t}` : `${argName}: Optional[${t}] = None`);
  }

  let pathExpr = `"${op.path}"`;
  if (op.pathParams?.length) {
    let templ = op.path;
    for (const p of op.pathParams) {
      templ = templ.replace(`{${p}}`, `{quote(str(${snakeCase(p)}), safe='')}`);
    }
    pathExpr = `f"${templ}"`;
  }

  const body: string[] = [];
  if (op.queryParams?.length) {
    const pairs = op.queryParams.map((q) => {
      const argName = snakeCase(q.argName ?? q.name);
      return `"${q.name}": ${argName}`;
    });
    body.push(`        params = _drop_none({${pairs.join(", ")}})`);
  }

  const callArgs = [`"${op.method}"`, pathExpr];
  if (op.queryParams?.length) callArgs.push("params=params");
  if (op.requestSchema) {
    callArgs.push("json_body=body.model_dump(by_alias=True, exclude_none=True)");
  }
  body.push(`        data = self._request(${callArgs.join(", ")})`);
  body.push(`        return ${op.responseSchema}.model_validate(data)`);

  return `    def ${snakeCase(op.name)}(${params.join(", ")}) -> ${op.responseSchema}:
        """${op.summary}"""
${body.join("\n")}`;
}

export function emitClient(): string {
  const modelImports = Array.from(
    new Set(
      OPERATIONS.flatMap((op) =>
        [op.responseSchema, op.requestSchema].filter(Boolean) as string[],
      ),
    ),
  ).sort();

  const methods = OPERATIONS.map(emitMethod).join("\n\n");

  return `${GEN_HEADER_PY}from __future__ import annotations

from typing import Any, Dict, Optional
from urllib.parse import quote

from .models import (
${modelImports.map((m) => `    ${m},`).join("\n")}
)

DEFAULT_BASE_URL = "${DEFAULT_BASE_URL}"


def _drop_none(values: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in values.items() if v is not None}


class PharmacopeiaError(Exception):
    """Raised when the API returns a non-2xx response."""

    def __init__(
        self,
        message: str,
        *,
        code: Optional[str] = None,
        status: int = 0,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.details = details


class PharmacopeiaClient:
    """Thin, fully-typed client for the pharmacopeia API.

    Each method returns a Pydantic model matching the API response; non-2xx
    responses raise :class:\`PharmacopeiaError\` carrying the API error code
    and details. Usable as a context manager to close the underlying
    connection pool.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        import httpx

        merged: Dict[str, str] = {"Accept": "application/json"}
        if api_key:
            merged["Authorization"] = f"Bearer {api_key}"
        if headers:
            merged.update(headers)

        self._client = httpx.Client(
            base_url=base_url.rstrip("/") + "/",
            headers=merged,
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PharmacopeiaClient":
        return self

    def __exit__(self, *_exc: Any) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Any = None,
    ) -> Any:
        response = self._client.request(
            method,
            path.lstrip("/"),
            params=params,
            json=json_body,
        )
        if response.status_code >= 400:
            payload: Any = None
            try:
                payload = response.json()
            except ValueError:
                payload = None
            error = (payload or {}).get("error", {}) if isinstance(payload, dict) else {}
            raise PharmacopeiaError(
                error.get("message", response.reason_phrase),
                code=error.get("code"),
                status=response.status_code,
                details=error.get("details"),
            )
        return response.json()

${methods}
`;
}
