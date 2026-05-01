# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # compile TypeScript → dist/
npm run watch       # incremental compile on save
npm run dev         # run directly via tsx (no build needed, dev only)
npm run start       # run compiled output (requires build first)
```

There are no tests or linters configured. After any source change, run `npm run build` before the MCP server will pick up the changes (Claude Code must be restarted to reload the server).

## Architecture

This is a single-file MCP server (`src/index.ts`) that bridges Claude Code to a local AEM instance via two AEM HTTP APIs:

- **`search_content`** → `GET /bin/querybuilder.json` (AEM QueryBuilder API). Builds query params from tool arguments and returns selective hits (path, title, description, resourceType).
- **`get_page`** → `GET /{path}.{depth}.json` (Sling GET servlet). Fetches a node tree at the given JCR path.

Both tools share a single `aemFetch()` helper that injects Basic Auth and throws on non-2xx responses.

**Transport:** stdio — Claude Code spawns the process; the server must never write to stdout (stdout is the MCP protocol channel). Use `process.stderr.write()` for any logging.

**Auth:** Credentials are read exclusively from env vars `AEM_BASE_URL`, `AEM_USER`, `AEM_PASS`. The server exits immediately at startup if any are missing. These are injected by Claude Code via `.mcp.json` (gitignored — copy from `.mcp.json.example` to configure locally).

## Adding a new tool

1. Add an entry to the `tools` array in the `ListToolsRequestSchema` handler (name, description, inputSchema).
2. Add a matching `if (name === "your_tool")` branch in the `CallToolRequestSchema` handler.
3. Return `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }`.
4. Run `npm run build` and restart Claude Code.
