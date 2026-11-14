import { describe, expect, it } from "vitest";
import { ChatCompletionResponseSchema } from "@antigravity-connector/protocol/Schemas/ChatCompletionResponseSchema.ts";

describe("ChatCompletionResponseSchema", () => {
  it("parses an invented chat completion", () => {
    const body = {
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 1700000000,
      model: "gemini-3.8-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "pong" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      conversation_id: "00000000-0000-4000-8000-000000000000",
    };

    const result = ChatCompletionResponseSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });
});
