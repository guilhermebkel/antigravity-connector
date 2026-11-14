import { describe, expect, it } from "vitest";
import { AgyStatusUtil } from "@antigravity-connector/protocol/Utils/AgyStatusUtil.ts";

describe("AgyStatusUtil.parse", () => {
  it.each([
    { value: "SUCCESS", status: "SUCCESS" },
    { value: "ERROR", status: "ERROR" },
    { value: "QUEUED", status: "unknown" },
    { value: "toString", status: "unknown" },
  ])("parses $value as $status", ({ value, status }) => {
    expect(AgyStatusUtil.parse(value)).toBe(status);
  });
});
