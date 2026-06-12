import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildOpenApi, emitOpenApi } from "@/lib/sdk/openapi";
import { buildSchemaBundle, SCHEMA_REGISTRY } from "@/lib/sdk/registry";
import {
  API_BASE_PATH,
  API_TAGS,
  OPERATIONS,
  type Operation,
} from "@/lib/sdk/manifest";

/**
 * Drift guards. The SDK manifest, the generated OpenAPI document, and
 * the route files under app/api/v1 are three views of one API surface.
 * These tests fail the build the moment they disagree — so the spec,
 * the SDK clients, and the live API can never quietly diverge.
 */

const ROOT = process.cwd();
const SCHEMA_NAMES = new Set(SCHEMA_REGISTRY.map(([name]) => name));

/**
 * Map a manifest path template to the route file Next.js resolves it
 * to: `/drug/{slug}/similar` → `app/api/v1/drug/[slug]/similar/route.ts`.
 */
function routeFileFor(op: Operation): string {
  const segments = op.path
    .replace(/^\//, "")
    .split("/")
    .map((seg) => seg.replace(/^\{(.+)\}$/, "[$1]"));
  return join(ROOT, "app", "api", "v1", ...segments, "route.ts");
}

describe("manifest ↔ registry", () => {
  it("every operation's response schema exists in the registry", () => {
    for (const op of OPERATIONS) {
      expect(
        SCHEMA_NAMES.has(op.responseSchema),
        `${op.name} → responseSchema ${op.responseSchema}`,
      ).toBe(true);
    }
  });

  it("every operation's request schema (when present) exists in the registry", () => {
    for (const op of OPERATIONS) {
      if (!op.requestSchema) continue;
      expect(
        SCHEMA_NAMES.has(op.requestSchema),
        `${op.name} → requestSchema ${op.requestSchema}`,
      ).toBe(true);
    }
  });

  it("every operation tag is a declared API tag", () => {
    const tags = new Set(API_TAGS.map((t) => t.name));
    for (const op of OPERATIONS) {
      expect(tags.has(op.tag), `${op.name} → tag ${op.tag}`).toBe(true);
    }
  });

  it("operation names are unique", () => {
    const names = OPERATIONS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("manifest ↔ routes", () => {
  it("every operation resolves to a route file that exports its method", () => {
    for (const op of OPERATIONS) {
      const file = routeFileFor(op);
      expect(existsSync(file), `${op.name} → ${file}`).toBe(true);
      const src = readFileSync(file, "utf8");
      // Handlers are exported as `export async function GET` or
      // re-exported (`export { handle as GET }`). Match either.
      const exported =
        new RegExp(`export\\s+(async\\s+)?function\\s+${op.method}\\b`).test(
          src,
        ) || new RegExp(`as\\s+${op.method}\\b`).test(src);
      expect(exported, `${op.name} → exports ${op.method} in ${file}`).toBe(
        true,
      );
    }
  });

  it("API base path is /api/v1", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
  });
});

describe("OpenAPI document", () => {
  const bundle = buildSchemaBundle();
  const doc = buildOpenApi(bundle);

  it("declares OpenAPI 3.1", () => {
    expect(doc.openapi).toMatch(/^3\.1\./);
  });

  it("exposes a path+method for every manifest operation", () => {
    const paths = doc.paths as Record<string, Record<string, unknown>>;
    for (const op of OPERATIONS) {
      const fullPath = `${API_BASE_PATH}${op.path}`;
      const item = paths[fullPath];
      expect(item, `missing path ${fullPath}`).toBeTruthy();
      expect(
        item[op.method.toLowerCase()],
        `missing ${op.method} ${fullPath}`,
      ).toBeTruthy();
    }
  });

  it("references only schemas that exist in components", () => {
    const components = (doc.components as { schemas: Record<string, unknown> })
      .schemas;
    const refs = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "$ref" && typeof v === "string") {
            const name = v.split("/").pop();
            if (name) refs.add(name);
          } else {
            walk(v);
          }
        }
      }
    };
    walk(doc.paths);
    walk(components);
    for (const ref of refs) {
      expect(components[ref], `dangling $ref → ${ref}`).toBeDefined();
    }
  });

  it("matches the committed sdk/openapi.json byte-for-byte (codegen is fresh)", () => {
    const committed = readFileSync(join(ROOT, "sdk", "openapi.json"), "utf8");
    expect(emitOpenApi(bundle)).toBe(committed);
  });
});
