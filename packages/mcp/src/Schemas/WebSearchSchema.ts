import { z } from "zod";
import type { WebSearchInput, WebSearchOutput } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";

const WEB_SEARCH_QUERY_MAX_LENGTH = 2000;

export const WebSearchInputSchema: z.ZodType<WebSearchInput> = z.strictObject({
  query: z.string().trim().min(1).max(WEB_SEARCH_QUERY_MAX_LENGTH),
  model: z.enum(["gemini-4-argon", "gemini-3.8-flash"]).optional(),
});

export const WebSearchOutputSchema: z.ZodType<WebSearchOutput> = z.object({
  answer: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  model: z.string(),
  durationMs: z.number(),
  totalTokens: z.number(),
});
