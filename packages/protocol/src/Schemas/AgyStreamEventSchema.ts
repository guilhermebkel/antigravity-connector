import { z } from "zod";
import type { AgyStreamEvent } from "@antigravity-connector/protocol/Protocols/AgyStreamEventProtocol.ts";
import { AgyEnvelopeSchema } from "@antigravity-connector/protocol/Schemas/AgyEnvelopeSchema.ts";
import { AgyUsageSchema } from "@antigravity-connector/protocol/Schemas/AgyUsageSchema.ts";

const AgyInitEventSchema = z.looseObject({
  event: z.literal("init"),
  conversation_id: z.string(),
  init: z.looseObject({
    cwd: z.string(),
    tools: z.array(z.string()),
    permission_mode: z.string(),
  }),
});

const AgyStepUpdateEventSchema = z.looseObject({
  event: z.literal("step_update"),
  step_update: z.looseObject({
    conversation_id: z.string(),
    step_index: z.number(),
    state: z.enum(["ACTIVE", "DONE"]),
    step_type: z.enum(["user_input", "agent_response", "tool"]),
    tool_name: z.string().optional(),
    tool_info: z.unknown().optional(),
    text_delta: z.string().optional(),
    duration_seconds: z.number().optional(),
    usage: AgyUsageSchema.optional(),
  }),
});

const AgyResultEventSchema = z.looseObject({
  event: z.literal("result"),
  result: AgyEnvelopeSchema,
});

const AgyUnknownStreamEventSchema = z.looseObject({
  event: z.string(),
});

// Why: the last member is the fallback of AC4 in issue #6: a line whose type or step type is not mapped parses here, and the run ignores it.
export const AgyStreamEventSchema: z.ZodType<AgyStreamEvent> = z.union([
  AgyInitEventSchema,
  AgyStepUpdateEventSchema,
  AgyResultEventSchema,
  AgyUnknownStreamEventSchema,
]);
