import { describe, expect, it } from "vitest";
import { ChatCompletionChunkSchema } from "@antigravity-connector/protocol/Schemas/ChatCompletionChunkSchema.ts";

const BASE = { id: "chatcmpl-1", created: 1700000000, model: "gemini-3.8-flash" };

describe("ChatCompletionChunkSchema", () => {
  it("parses a text delta", () => {
    const body = {
      ...BASE,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: "po" }, finish_reason: null }],
    };

    const result = ChatCompletionChunkSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });

  it("parses the trailing usage chunk with no choices", () => {
    const body = {
      ...BASE,
      object: "chat.completion.chunk",
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    };

    const result = ChatCompletionChunkSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });
});
