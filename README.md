# aem-mcp-server

A TypeScript MCP server that connects Claude Code to a local AEM instance, enabling AI-assisted querying and browsing of AEM content.

## How it works

```
You (natural language)
       │
       ▼
 Claude Code (AI)
       │  decides to call a tool, e.g. search_content
       │  communicates over stdio (MCP protocol)
       ▼
 aem-mcp-server (this project)
       │  translates the tool call into an HTTP request
       │  e.g. GET /bin/querybuilder.json?fulltext=checkout&path=/content
       ▼
 Local AEM (localhost:4502)
       │  executes the query and returns JSON
       ▼
 aem-mcp-server
       │  returns the result back over stdio
       ▼
 Claude Code
       │  reads the JSON and answers you in natural language
       ▼
You
```

When you ask Claude something like _"find all pages about checkout under /content/mysite"_, Claude decides which tool to call and what arguments to pass. This server receives that call, builds the equivalent AEM HTTP request, and returns the raw result. Claude then interprets the JSON and responds in plain language.

The server is spawned as a subprocess by Claude Code on startup — you never run it manually.

## Tools

| Tool | Description |
|------|-------------|
| `search_content` | Search AEM content via QueryBuilder API (`/bin/querybuilder.json`) |
| `get_page` | Fetch a specific AEM page/node by JCR path via Sling GET servlet |

## Prerequisites

- Node.js 18+
- A running AEM instance (default: `http://localhost:4502`)
- Claude Code CLI

## Setup

**1. Clone and install**

```bash
git clone git@github.com:gilbert-lee-tech/aem-mcp-server.git
cd aem-mcp-server
npm install
```

**2. Configure credentials**

```bash
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json` with your AEM credentials:

```json
{
  "mcpServers": {
    "aem": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "AEM_BASE_URL": "http://localhost:4502",
        "AEM_USER": "your-username",
        "AEM_PASS": "your-password"
      }
    }
  }
}
```

**3. Build**

```bash
npm run build
```

**4. Register with Claude Code**

```bash
claude mcp add --transport stdio aem node -- /path/to/aem-mcp-server/dist/index.js
```

Then restart Claude Code. Verify the connection:

```bash
claude mcp list
# aem: node /path/to/dist/index.js - ✓ Connected
```

## Usage

Once connected, ask Claude naturally:

> "Search AEM for all cq:Page nodes under /content/mysite"

> "Get the page at /content/mysite/en/home with depth 2"

> "Find all pages using the template /conf/mysite/settings/wcm/templates/landing-page"

## Unregister from Claude Code

```bash
claude mcp remove aem
```

Then restart Claude Code. To confirm it's gone:

```bash
claude mcp list
```

## Development

```bash
npm run watch   # recompile on save
npm run dev     # run without building (tsx)
```

After any source change, run `npm run build` and restart Claude Code to reload the server.
