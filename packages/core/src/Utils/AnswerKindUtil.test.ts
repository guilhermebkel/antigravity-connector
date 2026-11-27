import { describe, expect, it } from "vitest";
import { AnswerKindUtil } from "@antigravity-connector/core/Utils/AnswerKindUtil.ts";

describe("AnswerKindUtil.classify", () => {
  it.each([
    ["The image model returned 429 RESOURCE_EXHAUSTED; quota resets in 2 hours.", "quota"],
    ["You have hit the rate limit for this model.", "quota"],
    ["I cannot generate that picture because of the safety policy.", "refusal"],
    ["The image is still generating. I will notify you when it is ready.", "promise"],
    ["The subagent is working in the background.", "promise"],
    ["Quota exceeded, so I will notify you later.", "quota"],
    ["Here is your cat.", "other"],
    ["   ", "empty"],
    ["", "empty"],
  ])("reads %j as %s", (answer, kind) => {
    expect(AnswerKindUtil.classify(answer)).toBe(kind);
  });
});
