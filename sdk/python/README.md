# pharmacopeia (Python client)

Thin, fully-typed Python client for the [pharmacopeia](https://pharmacopeia.dev)
reference API. Models are Pydantic v2 classes generated from the same Zod
schemas the API uses, so request and response shapes can never silently
drift from the server.

> Educational / informational use only. Not a clinical decision-support tool.

## Install

```bash
pip install pharmacopeia
```

Depends on `httpx` and `pydantic>=2`.

## Usage

```python
from pharmacopeia import PharmacopeiaClient, InteractionCheckRequest

with PharmacopeiaClient() as client:
    # or PharmacopeiaClient("http://localhost:3000/api/v1")
    page = client.list_drugs(limit=10)
    drug = client.get_drug("metformin")

    report = client.check_interactions(
        InteractionCheckRequest(drugs=["warfarin", "aspirin"])
    )
    print(report.summary.major)

    hits = client.search(q="statin", limit=5)
```

Responses are typed Pydantic models. JSON `camelCase` keys are exposed as
`snake_case` attributes (e.g. `drug.short_description`, `stats.updated_at`),
while still validating and serializing against the wire names.

## Errors

Non-2xx responses raise `PharmacopeiaError` with the API's structured
error envelope:

```python
from pharmacopeia import PharmacopeiaClient, PharmacopeiaError

with PharmacopeiaClient() as client:
    try:
        client.get_drug("does-not-exist")
    except PharmacopeiaError as err:
        print(err.status)   # 404
        print(err.code)     # "not_found"
        print(err.details)
```

## Generated

`pharmacopeia/models.py`, `pharmacopeia/client.py`, and
`pharmacopeia/__init__.py` are generated. Do not edit them by hand — see
[`../README.md`](../README.md) and run `npm run codegen` from the repo root.
