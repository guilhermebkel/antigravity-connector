import { z } from "zod";
import type { AgyUsage } from "@antigravity-connector/protocol/Protocols/AgyEnvelopeProtocol.ts";

export const AgyUsageSchema: z.ZodType<AgyUsage> = z.looseObject({
  input_tokens: z.number(),
  output_tokens: z.number(),
  thinking_tokens: z.number(),
  cache_read_tokens: z.number(),
  total_tokens: z.number(),
});
