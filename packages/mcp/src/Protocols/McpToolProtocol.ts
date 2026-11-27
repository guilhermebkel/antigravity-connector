import type { z } from "zod";
import type { ContentBlock, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type {
  AgyLoginService,
  AgyRunService,
  ImageRunService,
  ImageSourceService,
  ImageUploadService,
  MediaRunService,
  RunObserver,
} from "@antigravity-connector/core";
import type { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

export type McpToolAnnotations = ToolAnnotations;

export type McpToolContext = {
  runService: AgyRunService;
  imageService: ImageRunService;
  imageSourceService: ImageSourceService;
  imageUploadService: ImageUploadService;
  mediaService: MediaRunService;
  toolJobs: ToolJobService;
  loginService: AgyLoginService;
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
