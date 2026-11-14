import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class McpResultUtil {
  static buildSuccess(output: Record<string, unknown>, summary: string): CallToolResult {
    return {
      content: [{ type: "text", text: `${summary}\n${JSON.stringify(output)}` }],
      structuredContent: output,
    };
  }

  static buildFailure(message: string): CallToolResult {
    return { content: [{ type: "text", text: message }], isError: true };
  }
}
