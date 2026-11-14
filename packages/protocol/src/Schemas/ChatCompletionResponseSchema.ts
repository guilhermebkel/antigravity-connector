import { z } from "zod";
import type { ChatCompletionResponse, OpenAiFinishReason } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";
import { OpenAiUsageSchema } from "@antigravity-connector/protocol/Schemas/OpenAiUsageSchema.ts";

const OpenAiFinishReasonSchema: z.ZodType<OpenAiFinishReason> = z.enum(["stop", "length", "tool_calls", "content_filter"]);

export const ChatCompletionResponseSchema: z.ZodType<ChatCompletionResponse> = z.looseObject({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.looseObject({
      index: z.number(),
      message: z.looseObject({ role: z.literal("assistant"), content: z.string() }),
      finish_reason: OpenAiFinishReasonSchema,
    }),
  ),
  usage: OpenAiUsageSchema,
  conversation_id: z.string(),
});
