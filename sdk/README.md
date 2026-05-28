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
