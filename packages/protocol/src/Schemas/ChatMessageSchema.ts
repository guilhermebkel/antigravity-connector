import { z } from "zod";
import type { OpenAiContentPart, OpenAiMessage, OpenAiRole } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";

const OpenAiRoleSchema: z.ZodType<OpenAiRole> = z.enum(["system", "developer", "user", "assistant"]);

const OpenAiContentPartSchema: z.ZodType<OpenAiContentPart> = z.union([
  z.looseObject({ type: z.literal("text"), text: z.string() }),
  z.looseObject({
    type: z.literal("image_url"),
    image_url: z.looseObject({ url: z.string(), detail: z.enum(["auto", "low", "high"]).optional() }),
  }),
]);

export const ChatMessageSchema: z.ZodType<OpenAiMessage> = z.looseObject({
  role: OpenAiRoleSchema,
  content: z.union([z.string(), z.array(OpenAiContentPartSchema)]),
});
