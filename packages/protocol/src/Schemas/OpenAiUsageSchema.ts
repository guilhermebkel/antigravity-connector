import { z } from "zod";
import type { OpenAiUsage } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";

export const OpenAiUsageSchema: z.ZodType<OpenAiUsage> = z.looseObject({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  completion_tokens_details: z.looseObject({ reasoning_tokens: z.number() }).optional(),
  prompt_tokens_details: z.looseObject({ cached_tokens: z.number() }).optional(),
});
