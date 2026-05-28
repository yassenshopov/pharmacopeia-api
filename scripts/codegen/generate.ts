import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSchemaBundle } from "@/lib/sdk/registry";
import * as ts from "./emit-ts";
import * as py from "./emit-py";
import { emitOpenApi } from "./emit-openapi";
import { GEN_HEADER_PY } from "./util";

const ROOT = process.cwd();

function write(relativePath: string, contents: string): void {
  const full = join(ROOT, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
  console.log(`  wrote ${relativePath}`);
}

function emitPythonInit(order: string[]): string {
  const exports = [...order, "PharmacopeiaClient", "PharmacopeiaError", "DEFAULT_BASE_URL"];
  const all = exports.map((n) => `    "${n}",`).join("\n");
  return `${GEN_HEADER_PY}from .client import DEFAULT_BASE_URL, PharmacopeiaClient, PharmacopeiaError
from .models import (
${order.map((n) => `    ${n},`).join("\n")}
)

__all__ = [
${all}
]
`;
}

function main(): void {
  console.log("Generating SDK clients from Zod schemas...");
  const bundle = buildSchemaBundle();

  write("sdk/typescript/src/types.ts", ts.emitTypes(bundle));
  write("sdk/typescript/src/client.ts", ts.emitClient());

  write("sdk/python/pharmacopeia/models.py", py.emitModels(bundle));
  write("sdk/python/pharmacopeia/client.py", py.emitClient());
  write("sdk/python/pharmacopeia/__init__.py", emitPythonInit(bundle.order));

  write("sdk/openapi.json", emitOpenApi(bundle));

  console.log(`Done. ${bundle.order.length} schemas emitted.`);
}

main();
