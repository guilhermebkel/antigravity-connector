import { describe, expect, it } from "vitest";
import { ImageNotProducedError, ImageTimeoutError } from "@antigravity-connector/core";
import { McpErrorUtil } from "@antigravity-connector/mcp/Utils/McpErrorUtil.ts";

describe("McpErrorUtil.describe for image calls", () => {
  it("names the last step and the silent time when an image call times out", () => {
    const text = McpErrorUtil.describe(new ImageTimeoutError({ step: "subagent ACTIVE", idleMs: 200000 }));

    expect(text).toContain("did not make the image in time");
    expect(text).toContain("last step: subagent ACTIVE, silent for 200 s");
    expect(text).toContain("out of quota");
  });

  it("still gives a clear text when agy sent nothing before the timeout", () => {
    const text = McpErrorUtil.describe(new ImageTimeoutError());

    expect(text).toContain("did not make the image in time.");
    expect(text).not.toContain("last step");
  });

  it("keeps agy's answer as the reason when no image was written", () => {
    const text = McpErrorUtil.describe(new ImageNotProducedError("429 RESOURCE_EXHAUSTED"));

    expect(text).toContain("429 RESOURCE_EXHAUSTED");
  });
});
