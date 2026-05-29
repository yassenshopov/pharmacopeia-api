# pharmacopeia-mcp

Model Context Protocol server for the [pharmacopeia API](https://pharmacopeia.dev).

Lets Claude, Cursor, Codex, and any other MCP-aware agent pull drug,
class, ingredient, interaction, and structure facts straight into the
context window.

Educational and informational use only — never a substitute for
professional medical advice.

## Install

The fastest path is `npx`, which any MCP host can spawn:

```bash
npx -y pharmacopeia-mcp
```

Or install globally:

```bash
npm install -g pharmacopeia-mcp
```

## Configure

### Claude Desktop

Add an entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pharmacopeia": {
      "command": "npx",
      "args": ["-y", "pharmacopeia-mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (or the project-local `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pharmacopeia": {
      "command": "npx",
      "args": ["-y", "pharmacopeia-mcp"]
    }
  }
}
```

### Environment

| Variable                 | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `PHARMACOPEIA_BASE_URL`  | Override the API base URL (default: production). |
| `PHARMACOPEIA_API_KEY`   | Bearer token forwarded as `Authorization`.       |

## Tools

| Tool                     | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `get_drug`               | Full drug record by slug.                              |
| `get_drugs_batch`        | Resolve up to 100 slugs in one call.                   |
| `list_drugs`             | Paginated drug list, with class / ingredient filters.  |
| `get_drug_interactions`  | Structured pairwise interactions for a drug.           |
| `get_similar_drugs`      | Structural analogs by 2D Tanimoto.                     |
| `list_classes`           | Paginated drug-class list.                             |
| `get_class`              | Drug class + its members.                              |
| `list_ingredients`       | Paginated ingredients list.                            |
| `get_ingredient`         | Single ingredient record.                              |
| `list_brands`            | Brand → generic crosswalk.                             |
| `search`                 | Full-text search across drugs, classes, ingredients.   |
| `structure_search`       | Rank drugs by 2D Tanimoto similarity to a SMILES.      |
| `check_interactions`     | Severity-graded pairwise check for 2–20 slugs.         |
| `get_drug_shortages`     | FDA shortage entries for a drug.                       |
| `list_shortages`         | All FDA shortage entries across the dataset.           |
| `get_drug_adverse_events`| Aggregate FAERS report counts (reporting volume only). |
| `get_drug_literature`    | Curated PubMed references (MeSH major topic).          |
| `list_reactions`         | Browse MedDRA Preferred Terms (FAERS PT directory).    |
| `get_reaction`           | One reaction: per-drug shares + related reactions.     |
| `get_stats`              | Dataset counts + version metadata.                     |
| `get_health`             | Liveness, dataset version, deployment commit.          |
| `list_changelog`         | Recent record-level changes.                           |

Every tool is a thin wrapper over the generated
[`@pharmacopeia/client`](https://www.npmjs.com/package/@pharmacopeia/client),
so the surface tracks the live API contract automatically.

## License

MIT
