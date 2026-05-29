import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Stamp a version into both SDK manifests so a release tag is the
 * single source of truth for the published package version.
 *
 *   tsx scripts/codegen/set-sdk-version.ts 0.2.0
 *
 * The version is validated against SemVer (no `v` prefix). Both
 * sdk/typescript/package.json and sdk/python/pyproject.toml are
 * rewritten in place; everything else in those files is preserved.
 */

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const ROOT = process.cwd();

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function setTsVersion(version: string): void {
  const path = join(ROOT, "sdk/typescript/package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`  set ${path} version = ${version}`);
}

/**
 * Stamp the MCP server package, and bump its `@pharmacopeia/client`
 * dependency in lockstep. The two packages are released together so a
 * given `sdk-vX.Y.Z` tag always means the MCP tools were built against
 * exactly that version of the client.
 */
function setMcpVersion(version: string): void {
  const path = join(ROOT, "sdk/mcp/package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as {
    version: string;
    dependencies?: Record<string, string>;
  };
  pkg.version = version;
  if (pkg.dependencies && pkg.dependencies["@pharmacopeia/client"]) {
    pkg.dependencies["@pharmacopeia/client"] = `^${version}`;
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`  set ${path} version = ${version}`);
}

function setPyVersion(version: string): void {
  const path = join(ROOT, "sdk/python/pyproject.toml");
  const text = readFileSync(path, "utf8");
  // Replace the first `version = "…"` line inside the [project] table. We
  // intentionally rewrite the whole line rather than parse the TOML so this
  // script stays dependency-free.
  const next = text.replace(
    /(?<=\n)version\s*=\s*"[^"]*"/,
    `version = "${version}"`,
  );
  if (next === text) {
    fail(`Could not find version line in ${path}`);
  }
  writeFileSync(path, next, "utf8");
  console.log(`  set ${path} version = ${version}`);
}

function main(): void {
  const raw = process.argv[2];
  if (!raw) fail("Usage: set-sdk-version.ts <version>");

  const version = raw.replace(/^v/, "").replace(/^sdk-v/, "");
  if (!SEMVER_RE.test(version)) {
    fail(`Not a SemVer version: ${raw}`);
  }

  setTsVersion(version);
  setMcpVersion(version);
  setPyVersion(version);
  console.log(`Done. Stamped SDK manifests with ${version}.`);
}

main();
