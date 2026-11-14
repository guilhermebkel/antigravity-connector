import type { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { AgyRunService } from "@antigravity-connector/core";

export type McpToolAnnotations = ToolAnnotations;

export type McpToolContext = {
  runService: AgyRunService;
  signal: AbortSignal | undefined;
};

export interface McpToolPort<I, O extends Record<string, unknown>> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema: z.ZodType<O>;
  readonly annotations: McpToolAnnotations;
  run(input: I, context: McpToolContext): Promise<O>;
  summarize(output: O): string;
}
