import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServices } from "@antigravity-connector/mcp/Protocols/McpServicesProtocol.ts";
import { McpInstructionsUtil } from "@antigravity-connector/mcp/Utils/McpInstructionsUtil.ts";
import { McpManifestUtil } from "@antigravity-connector/mcp/Utils/McpManifestUtil.ts";

export class McpServerSetup {
  static readonly SERVER_NAME = "antigravity-connector";

  static readonly SERVER_VERSION = "0.0.0";

  static build(services: McpServices): McpServer {
    const server = new McpServer(
      { name: McpServerSetup.SERVER_NAME, version: McpServerSetup.SERVER_VERSION },
      { instructions: McpInstructionsUtil.build() },
    );
    McpManifestUtil.registerAll(server, services);
    return server;
  }
}
