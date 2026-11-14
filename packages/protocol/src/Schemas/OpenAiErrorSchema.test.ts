import { describe, expect, it } from "vitest";
import { OpenAiErrorSchema } from "@antigravity-connector/protocol/Schemas/OpenAiErrorSchema.ts";

const ERROR_BODY = {
  error: {
    message: "The daily limit for chat is reached.",
    type: "rate_limit_error",
    param: null,
    code: "daily_limit_reached",
  },
};

describe("OpenAiErrorSchema", () => {
  it("parses an error with a code this server uses", () => {
    const result = OpenAiErrorSchema.safeParse(ERROR_BODY);

    expect(result.data).toStrictEqual(ERROR_BODY);
  });

  it("refuses a code this server does not declare", () => {
    const result = OpenAiErrorSchema.safeParse({ error: { ...ERROR_BODY.error, code: "made_up_code" } });

    expect(result.success).toBe(false);
  });
});
