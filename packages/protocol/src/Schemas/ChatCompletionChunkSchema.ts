import { z } from "zod";
import type { ChatCompletionChunk, OpenAiFinishReason } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";
import { OpenAiUsageSchema } from "@antigravity-connector/protocol/Schemas/OpenAiUsageSchema.ts";

const OpenAiFinishReasonSchema: z.ZodType<OpenAiFinishReason> = z.enum(["stop", "length", "tool_calls", "content_filter"]);

export const ChatCompletionChunkSchema: z.ZodType<ChatCompletionChunk> = z.looseObject({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.looseObject({
      index: z.number(),
      delta: z.looseObject({
        role: z.literal("assistant").optional(),
        content: z.string().optional(),
      }),
      finish_reason: OpenAiFinishReasonSchema.nullable(),
    }),
  ),
  usage: OpenAiUsageSchema.nullable().optional(),
});
