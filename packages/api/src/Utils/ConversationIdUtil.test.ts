import { describe, expect, it } from "vitest";
import { ConversationIdUtil } from "@antigravity-connector/api/Utils/ConversationIdUtil.ts";

describe("ConversationIdUtil.isValid", () => {
  it("accepts an id in the format agy returns", () => {
    expect(ConversationIdUtil.isValid("00000000-0000-4000-8000-000000000000")).toBe(true);
  });

  it("AC3: refuses a flag-like id and an id with whitespace", () => {
    expect(ConversationIdUtil.isValid("--dangerously-skip-permissions")).toBe(false);
    expect(ConversationIdUtil.isValid("abc def")).toBe(false);
    expect(ConversationIdUtil.isValid("")).toBe(false);
  });
});
