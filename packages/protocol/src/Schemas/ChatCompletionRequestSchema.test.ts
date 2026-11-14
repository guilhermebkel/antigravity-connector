import { describe, expect, it } from "vitest";
import { FixtureUtil } from "@antigravity-connector/protocol/Testing/FixtureUtil.ts";
import { ChatCompletionRequestSchema } from "@antigravity-connector/protocol/Schemas/ChatCompletionRequestSchema.ts";

const MODEL = "gemini-3.8-flash";

const MINIMAL_BODY = {
  model: MODEL,
  messages: [{ role: "user", content: "hi" }],
};

describe("ChatCompletionRequestSchema", () => {
  it("parses the minimal body", () => {
    const result = ChatCompletionRequestSchema.safeParse(MINIMAL_BODY);

    expect(result.data).toStrictEqual(MINIMAL_BODY);
  });

  it.each([
    { name: "messages is missing", body: { model: MODEL } },
    { name: "messages is empty", body: { model: MODEL, messages: [] } },
  ])("names messages when $name", ({ body }) => {
    const result = ChatCompletionRequestSchema.safeParse(body);

    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["messages"]]);
  });

  it("keeps the order of the text parts of a content array", () => {
    const body = {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "first" },
            { type: "text", text: "second" },
          ],
        },
      ],
    };

    const result = ChatCompletionRequestSchema.safeParse(body);

    expect(result.data?.messages[0]?.content).toStrictEqual([
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ]);
  });

  it("accepts an unknown key", () => {
    const result = ChatCompletionRequestSchema.safeParse({ ...MINIMAL_BODY, x_client_hint: true });

    expect(result.data).toStrictEqual({ ...MINIMAL_BODY, x_client_hint: true });
  });

  it.each(["aiSdkGenerateTextRequest.json", "aiSdkStreamTextRequest.json"])(
    "parses the hand-written AI SDK body %s",
    (fileName) => {
      const result = ChatCompletionRequestSchema.safeParse(FixtureUtil.readJson(fileName));

      expect(result.success).toBe(true);
    },
  );
});
