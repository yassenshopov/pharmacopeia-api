# pharmacopeia Go client

A thin, fully-typed Go client for the [pharmacopeia](https://pharmacopeia.dev)
API. **Every type is generated from the same Zod schemas the API
validates against** (`npm run codegen`), so the Go SDK can never drift
from the live contract.

Educational and informational use only. Not a clinical decision-support
tool. See the project disclaimer.

## Install

```bash
go get github.com/pharmacopeia/pharmacopeia-go
```

```go
import pharmacopeia "github.com/pharmacopeia/pharmacopeia-go"
```

## Usage

```go
package main

import (
	"fmt"
	"log"
	"net/url"

	pharmacopeia "github.com/pharmacopeia/pharmacopeia-go"
)

func main() {
	client := pharmacopeia.NewClient()

	// Fetch a single drug.
	drug, err := client.GetDrug("metformin", nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(drug.Name, "→", drug.Slug)

	// Search (the required `q` is an explicit argument; optional params
	// such as `limit` ride along in url.Values).
	opts := url.Values{}
	opts.Set("limit", "5")
	results, err := client.Search("statin", opts)
	if err != nil {
		log.Fatal(err)
	}
	for _, r := range results.Results {
		fmt.Printf("  %s (%s)\n", r.Name, r.Kind)
	}

	// Dataset time-travel.
	history, err := client.GetDrugHistory("metformin", nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("snapshot extracted %s, %d change events\n",
		history.Provenance.ExtractedAt, history.Total)
}
```

### Configuration

`NewClient` takes functional options:

```go
client := pharmacopeia.NewClient(
	pharmacopeia.WithBaseURL("http://localhost:3000/api/v1"),
	pharmacopeia.WithAPIKey(os.Getenv("PHARMACOPEIA_API_KEY")), // key-gated routes
	pharmacopeia.WithHTTPClient(&http.Client{Timeout: 10 * time.Second}),
)
```

### Errors

Non-2xx responses return an `*APIError` carrying the API error `Code`,
`Message`, and `Details`:

```go
if _, err := client.GetDrug("not-a-real-drug", nil); err != nil {
	var apiErr *pharmacopeia.APIError
	if errors.As(err, &apiErr) {
		fmt.Println(apiErr.Status, apiErr.Code) // 404 not_found
	}
}
```

## Method conventions

- Path parameters are positional string arguments.
- Required query parameters are explicit, typed arguments.
- Optional query parameters ride in a trailing `url.Values` (pass `nil`
for none).
- Request bodies are passed as the generated request struct.
- Every method returns `*ResponseType, error`.

## Regenerating

`types.go` and `client.go` are generated — don't edit them by hand.
Change the Zod schema or `lib/sdk/manifest.ts` and run `npm run codegen`
from the repo root.

## Releasing

Go modules are versioned by git tags fetched through the module proxy —
there is no registry publish step. Tagging the repo `sdk-vX.Y.Z` (the
same tag that releases the npm and PyPI packages) makes
`github.com/pharmacopeia/pharmacopeia-go@vX.Y.Z` resolvable via
`go get`.