import { describe, expect, it } from "vitest";
import { OpenAiUsageUtil } from "@antigravity-connector/protocol/Utils/OpenAiUsageUtil.ts";

describe("OpenAiUsageUtil.map", () => {
  it("counts thinking tokens into completion tokens and keeps them as reasoning tokens", () => {
    const usage = { input_tokens: 10, output_tokens: 5, thinking_tokens: 3, cache_read_tokens: 2, total_tokens: 18 };

    expect(OpenAiUsageUtil.map(usage)).toStrictEqual({
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18,
      completion_tokens_details: { reasoning_tokens: 3 },
      prompt_tokens_details: { cached_tokens: 2 },
    });
  });
});
