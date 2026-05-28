# @pharmacopeia/client

Thin, fully-typed TypeScript client for the [pharmacopeia](https://pharmacopeia.dev)
reference API. Types are generated from the same Zod schemas the API uses,
so request and response shapes can never silently drift from the server.

> Educational / informational use only. Not a clinical decision-support tool.

## Install

```bash
npm install @pharmacopeia/client
```

Requires a runtime with a global `fetch` (Node 18+, Bun, Deno, browsers),
or pass your own `fetch` implementation.

## Usage

```ts
import { PharmacopeiaClient, PharmacopeiaError } from "@pharmacopeia/client";

const client = new PharmacopeiaClient();
// or: new PharmacopeiaClient({ baseUrl: "http://localhost:3000/api/v1" });

const { items, pagination } = await client.listDrugs({ limit: 10 });
const drug = await client.getDrug("metformin");
const { pairs, summary } = await client.checkInteractions({
  drugs: ["warfarin", "aspirin"],
});

const results = await client.search({ q: "statin", limit: 5 });
```

Every method is fully typed — `drug` above is a `Drug`, `items` is
`DrugSummary[]`, and so on. All entity and response types are exported:

```ts
import type { Drug, DrugSummary, InteractionCheckResponse } from "@pharmacopeia/client";
```

## Errors

Non-2xx responses throw `PharmacopeiaError`, which carries the API's
structured error envelope:

```ts
try {
  await client.getDrug("does-not-exist");
} catch (err) {
  if (err instanceof PharmacopeiaError) {
    console.error(err.status); // 404
    console.error(err.code);   // "not_found"
    console.error(err.message);
    console.error(err.details);
  }
}
```

## Options

```ts
new PharmacopeiaClient({
  baseUrl: "https://pharmacopeia.dev/api/v1", // default
  apiKey: "…",                                 // sent as Bearer token
  headers: { "X-Trace": "…" },                 // merged into every request
  fetch: customFetch,                          // defaults to globalThis.fetch
});
```

## Generated

`src/types.ts` and `src/client.ts` are generated. Do not edit them by
hand — see [`../README.md`](../README.md) and run `npm run codegen` from
the repo root.
