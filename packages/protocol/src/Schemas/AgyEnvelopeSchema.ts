import { z } from "zod";
import type { AgyEnvelope } from "@antigravity-connector/protocol/Protocols/AgyEnvelopeProtocol.ts";
import { AgyUsageSchema } from "@antigravity-connector/protocol/Schemas/AgyUsageSchema.ts";
import { AgyStatusUtil } from "@antigravity-connector/protocol/Utils/AgyStatusUtil.ts";

export const AgyEnvelopeSchema: z.ZodType<AgyEnvelope> = z.looseObject({
  conversation_id: z.string(),
  status: z.string().transform((value) => AgyStatusUtil.parse(value)),
  response: z.string(),
  usage: AgyUsageSchema,
  num_turns: z.number().optional(),
  duration_seconds: z.number().optional(),
  structured_output: z.unknown().optional(),
  error: z.string().optional(),
});
