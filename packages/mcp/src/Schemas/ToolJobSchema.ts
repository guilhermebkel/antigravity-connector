import { z } from "zod";
import type { ToolJobOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";

// Why: MCP needs one object schema per tool, so every long tool and get_result share this one. A "running" result has only the id and the retry delay; a "done" result has the fields of its kind, and the other fields are absent.
export const ToolJobOutputSchema: z.ZodType<ToolJobOutput> = z.object({
  status: z.enum(["done", "running"]),
  kind: z.enum(["image", "web_search", "research", "browse", "transcribe_audio", "analyse_video"]),
  jobId: z.string(),
  retryAfterSeconds: z.number().optional(),
  answer: z.string().optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  report: z.string().optional(),
  truncated: z.boolean().optional(),
  text: z.string().optional(),
  hasScreenshot: z.boolean().optional(),
  mimeType: z.literal("image/png").optional(),
  sizeBytes: z.number().optional(),
  model: z.string().optional(),
  durationMs: z.number().optional(),
  totalTokens: z.number().optional(),
});
