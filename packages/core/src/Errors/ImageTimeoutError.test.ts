import { describe, expect, it } from "vitest";
import { ImageTimeoutError } from "@antigravity-connector/core/Errors/ImageTimeoutError.ts";

describe("ImageTimeoutError.describeActivity", () => {
  it("names the last step and how long agy was silent, in whole seconds", () => {
    const error = new ImageTimeoutError({ step: "subagent ACTIVE", idleMs: 241400 });

    expect(error.describeActivity()).toBe("last step: subagent ACTIVE, silent for 241 s");
  });

  it("says nothing when agy sent no event at all", () => {
    expect(new ImageTimeoutError().describeActivity()).toBeUndefined();
  });
});
