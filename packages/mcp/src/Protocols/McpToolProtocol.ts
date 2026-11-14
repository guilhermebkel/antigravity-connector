import type { z } from "zod";
import type { ContentBlock, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { AgyRunService, ImageRunService, RunObserver } from "@antigravity-connector/core";

export type McpToolAnnotations = ToolAnnotations;

export type McpToolContext = {
  runService: AgyRunService;
  imageService: ImageRunService;
  signal: AbortSignal | undefined;
  observer: RunObserver;
};

export type McpToolRun<O> = {
  output: O;
  extraContent: ContentBlock[];
};

export interface McpToolPort<I, O extends Record<string, unknown>> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema: z.ZodType<O>;
  readonly annotations: McpToolAnnotations;
  run(input: I, context: McpToolContext): Promise<McpToolRun<O>>;
  summarize(output: O): string;
}
