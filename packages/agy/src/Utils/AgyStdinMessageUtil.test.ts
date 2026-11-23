import { describe, expect, it } from "vitest";
import { AgyStdinMessageUtil } from "@antigravity-connector/agy/Utils/AgyStdinMessageUtil.ts";

describe("AgyStdinMessageUtil.buildUserLine", () => {
  it("builds one JSON line with the prompt as the message content", () => {
    const line = AgyStdinMessageUtil.buildUserLine("draw a \"cat\"\nnow");

    expect(line.endsWith("\n")).toBe(true);
    expect(line.slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(line)).toStrictEqual({ event: "user", message: { content: "draw a \"cat\"\nnow" } });
  });
});
