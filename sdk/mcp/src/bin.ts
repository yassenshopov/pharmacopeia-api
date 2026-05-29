#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPharmacopeiaServer } from "./index.js";

/**
 * Stdio entry point. MCP hosts (Claude Desktop, Cursor, Codex, etc.)
 * spawn this binary as a child process and speak the protocol over its
 * stdin/stdout pipes.
 *
 * Configuration is environment-driven so a host can pin the API base
 * URL or an API key without command-line flags:
 *
 *   PHARMACOPEIA_BASE_URL  — override the API origin
 *   PHARMACOPEIA_API_KEY   — bearer token forwarded as Authorization
 *
 * A typical Claude Desktop entry looks like:
 *
 *   {
 *     "mcpServers": {
 *       "pharmacopeia": {
 *         "command": "npx",
 *         "args": ["-y", "pharmacopeia-mcp"]
 *       }
 *     }
 *   }
 */

async function main(): Promise<void> {
  const server = createPharmacopeiaServer({
    ...(process.env.PHARMACOPEIA_BASE_URL
      ? { baseUrl: process.env.PHARMACOPEIA_BASE_URL }
      : {}),
    ...(process.env.PHARMACOPEIA_API_KEY
      ? { apiKey: process.env.PHARMACOPEIA_API_KEY }
      : {}),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Stdout is reserved for protocol traffic; emit fatal errors on stderr
  // so the MCP host can surface them without breaking the JSON-RPC frame.
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`pharmacopeia-mcp: fatal: ${msg}\n`);
  process.exit(1);
});
