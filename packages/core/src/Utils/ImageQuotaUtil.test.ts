import { describe, expect, it } from "vitest";
import { ImageQuotaUtil } from "@antigravity-connector/core/Utils/ImageQuotaUtil.ts";

const HOUR = 3600000;
const MINUTE = 60000;
const SECOND = 1000;

describe("ImageQuotaUtil.readResetMs", () => {
  it.each([
    ["RESOURCE_EXHAUSTED: quota will reset after 4h28m46s.", 4 * HOUR + 28 * MINUTE + 46 * SECOND],
    ["You have exhausted your capacity. Your quota resets after 52m35s.", 52 * MINUTE + 35 * SECOND],
    ["quota resets after 1.5h", HOUR + 30 * MINUTE],
    ["quota resets after 2h", 2 * HOUR],
  ])("reads the reset time of %j", (answer, expected) => {
    expect(ImageQuotaUtil.readResetMs(answer)).toBe(expected);
  });

  it.each([
    "quota will reset in 2 hours",
    "429 RESOURCE_EXHAUSTED, try again later",
    "No quota answer here",
  ])("gives no reset time for %j", (answer) => {
    expect(ImageQuotaUtil.readResetMs(answer)).toBeUndefined();
  });
});
