import { z } from "zod";
import type { ChatCompletionRequest } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";
import { ChatMessageSchema } from "@antigravity-connector/protocol/Schemas/ChatMessageSchema.ts";

export const ChatCompletionRequestSchema: z.ZodType<ChatCompletionRequest> = z.looseObject({
  model: z.string(),
  messages: z.array(ChatMessageSchema).min(1),
  stream: z.boolean().optional(),
  stream_options: z.looseObject({ include_usage: z.boolean().optional() }).optional(),
  reasoning_effort: z.string().optional(),
  response_format: z
    .looseObject({
      type: z.enum(["text", "json_object", "json_schema"]),
      json_schema: z.unknown().optional(),
    })
    .optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  max_completion_tokens: z.number().optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.unknown().optional(),
  conversation_id: z.string().optional(),
});
