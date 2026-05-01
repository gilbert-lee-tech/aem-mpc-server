import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const AEM_BASE_URL = process.env.AEM_BASE_URL;
const AEM_USER = process.env.AEM_USER;
const AEM_PASS = process.env.AEM_PASS;

if (!AEM_BASE_URL || !AEM_USER || !AEM_PASS) {
  process.stderr.write("Error: AEM_BASE_URL, AEM_USER, and AEM_PASS env vars are required\n");
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${AEM_USER}:${AEM_PASS}`).toString("base64")}`;

async function aemFetch(path: string, params?: URLSearchParams): Promise<unknown> {
  const url = new URL(path, AEM_BASE_URL);
  if (params) {
    for (const [key, value] of params.entries()) {
      url.searchParams.append(key, value);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`AEM request failed: ${res.status} ${res.statusText} — ${url.toString()}`);
  }
  return res.json();
}

const server = new Server(
  { name: "aem-mpc-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_content",
      description:
        "Search AEM content using the QueryBuilder API. Returns matching nodes with their paths and properties.",
      inputSchema: {
        type: "object",
        properties: {
          fulltext: {
            type: "string",
            description: "Full-text search term",
          },
          path: {
            type: "string",
            description: "Root path to search under (e.g. /content/mysite)",
            default: "/content",
          },
          type: {
            type: "string",
            description: "JCR node type filter (e.g. cq:Page, dam:Asset)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default 10)",
            default: 10,
          },
          property: {
            type: "string",
            description: "Property name to filter on (e.g. jcr:content/cq:template)",
          },
          property_value: {
            type: "string",
            description: "Value the property must match",
          },
        },
        required: [],
      },
    },
    {
      name: "get_page",
      description:
        "Fetch a specific AEM page or node by its JCR path. Returns the page properties as JSON.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "JCR path of the page or node (e.g. /content/mysite/en/home)",
          },
          depth: {
            type: "number",
            description: "Child node depth to include (default 1, max 5)",
            default: 1,
          },
        },
        required: ["path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_content") {
    const params = new URLSearchParams();
    params.set("p.limit", String((args?.limit as number) ?? 10));

    if (args?.fulltext) params.set("fulltext", args.fulltext as string);

    const searchPath = (args?.path as string) ?? "/content";
    params.set("path", searchPath);

    if (args?.type) params.set("type", args.type as string);

    if (args?.property && args?.property_value) {
      params.set("property", args.property as string);
      params.set("property.value", args.property_value as string);
    }

    // Always include path and excerpt in results
    params.set("p.hits", "selective");
    params.set("p.properties", "jcr:path jcr:title jcr:description sling:resourceType");

    const data = await aemFetch("/bin/querybuilder.json", params);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  if (name === "get_page") {
    const path = args?.path as string;
    if (!path) throw new Error("path is required");

    const depth = Math.min((args?.depth as number) ?? 1, 5);
    const params = new URLSearchParams({ "infinity": String(depth) });
    // Sling GET servlet: append .json to path
    const data = await aemFetch(`${path}.${depth}.json`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers must not write to stdout (it's the transport channel).
  // Use stderr for any startup logging.
  process.stderr.write("AEM MCP server running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
