import type { AgyRunService } from "@antigravity-connector/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpToolContext, McpToolPort } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import { WebSearchTool } from "@antigravity-connector/mcp/Tools/WebSearchTool.ts";
import { McpErrorUtil } from "@antigravity-connector/mcp/Utils/McpErrorUtil.ts";
import { McpResultUtil } from "@antigravity-connector/mcp/Utils/McpResultUtil.ts";

export class McpManifestUtil {
  static registerAll(server: McpServer, runService: AgyRunService): void {
    const webSearch = new WebSearchTool();
    McpManifestUtil.registerTool(server, webSearch, runService);
    server.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      if (request.params.name !== webSearch.name) {
        throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
      }
      const parsed = webSearch.inputSchema.safeParse(request.params.arguments);
      if (!parsed.success) {
        const message = McpManifestUtil.describeIssues(webSearch.name, parsed.error.issues);
        throw new McpError(ErrorCode.InvalidParams, message);
      }
      return McpManifestUtil.invoke(webSearch, parsed.data, { runService, signal: extra.signal });
    });
  }

  static registerTool<I, O extends Record<string, unknown>>(
    server: McpServer,
    tool: McpToolPort<I, O>,
    runService: AgyRunService,
  ): void {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (input, extra) => McpManifestUtil.invoke(tool, input, { runService, signal: extra.signal }),
    );
  }

  static async invoke<I, O extends Record<string, unknown>>(
    tool: McpToolPort<I, O>,
    input: I,
    context: McpToolContext,
  ): Promise<CallToolResult> {
    try {
      const output = await tool.run(input, context);
      return McpResultUtil.buildSuccess(output, tool.summarize(output));
    } catch (error: unknown) {
      return McpResultUtil.buildFailure(McpErrorUtil.describe(error));
    }
  }

  static describeIssues(toolName: string, issues: readonly { message: string }[]): string {
    const details = issues.map((issue) => issue.message).join("; ");
    return `Invalid arguments for tool ${toolName}: ${details}`;
  }
}
