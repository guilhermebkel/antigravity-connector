import { z } from "zod";
import type { ResearchInput } from "@antigravity-connector/mcp/Protocols/ResearchProtocol.ts";

const RESEARCH_TOPIC_MAX_LENGTH = 2000;

export const ResearchInputSchema: z.ZodType<ResearchInput> = z.strictObject({
  topic: z.string().trim().min(1).max(RESEARCH_TOPIC_MAX_LENGTH),
  model: z.enum(["gemini-4-argon", "gemini-3.8-flash"]).optional(),
});
