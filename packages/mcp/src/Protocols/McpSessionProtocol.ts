import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export type McpSessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastSeenAtMs: number;
};
