# pharmacopeia SDK clients

Thin, fully-typed clients so consumers don't hand-roll `fetch` wrappers.
**Every type here is generated from the same Zod schemas the API
validates against** — there is no second, drifting copy of the contract.

```
sdk/
  typescript/   @pharmacopeia/client  — generated TS types + client
  python/       pharmacopeia          — generated Pydantic models + client
  openapi.json  OpenAPI 3.1 document  — for any other language
```

## How generation works

```
lib/schemas/*.ts        Zod schemas — the source of truth
lib/sdk/registry.ts     every named type, registered for codegen
lib/sdk/manifest.ts     the endpoint list (method, path, params, schemas)
        │
        ▼  npm run codegen   (scripts/codegen/)
        │   1. Zod → JSON Schema  (Zod v4 `z.toJSONSchema`)
        │   2. JSON Schema → TypeScript types + client
        │   3. JSON Schema → Pydantic models + client
        │   4. JSON Schema + manifest → OpenAPI 3.1
        ▼
sdk/typescript/src/{types,client}.ts
sdk/python/pharmacopeia/{models,client,__init__}.py
sdk/openapi.json
```

Re-run after any schema or endpoint change:

```bash
npm run codegen
```

The generated files carry an `AUTO-GENERATED` header. Don't edit them by
hand — change the Zod schema or the manifest and regenerate.

## Adding or changing an endpoint

1. Update / add the Zod schema in `lib/schemas/`.
2. If it's a new named type, register it in `lib/sdk/registry.ts`.
3. Add or edit the operation in `lib/sdk/manifest.ts`.
4. `npm run codegen`.

Both clients and the OpenAPI document update from that single edit.

See [`typescript/README.md`](./typescript/README.md) and
[`python/README.md`](./python/README.md) for usage.

## Releasing to npm and PyPI

Both packages are published from the same GitHub Actions workflow
(`.github/workflows/release-sdks.yml`) so they never disagree on the
contract they advertise.

### One-time setup

1. **npm.** Create an automation token with publish access to
   `@pharmacopeia/client` and add it to the GitHub repo secrets as
   `NPM_TOKEN`. Add a GitHub environment named `npm` (Settings →
   Environments) for protection rules; the workflow targets it.
2. **PyPI.** Use trusted publishing (no token needed). On
   <https://pypi.org/manage/account/publishing/> add a pending
   publisher with:
   - PyPI Project Name: `pharmacopeia`
   - Owner: `<github-owner>`
   - Repository: `pharmacopeia-api`
   - Workflow: `release-sdks.yml`
   - Environment: `pypi`

   Then add a matching `pypi` environment in the GitHub repo.

### Cutting a release

```bash
# 1. (optional) Locally verify the build first.
npm run codegen
npm run sdk:set-version -- 0.2.0
npm run sdk:build:ts
npm run sdk:build:py

# 2. Tag and push.
git tag sdk-v0.2.0
git push origin sdk-v0.2.0

# 3. Create a GitHub Release pointing at that tag. The workflow:
#    - regenerates the SDKs from the live Zod schemas
#    - stamps both manifests with 0.2.0
#    - publishes @pharmacopeia/client@0.2.0 to npm (with provenance)
#    - publishes pharmacopeia==0.2.0 to PyPI via OIDC
```

`npm run sdk:set-version -- <semver>` is the same step the workflow
runs; it rewrites `sdk/typescript/package.json` and
`sdk/python/pyproject.toml` in place so the tag is the single source of
truth for the published version. The tag prefix `sdk-v` is honoured but
optional — `v0.2.0` and `0.2.0` work too.

For a dry run, trigger the workflow manually (Actions → Release SDKs →
Run workflow) with `dry_run: true` to validate the build and stamping
without publishing.
