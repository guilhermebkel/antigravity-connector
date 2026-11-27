import { describe, expect, it } from "vitest";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgyUsageParseUtil } from "@antigravity-connector/agy/Utils/AgyUsageParseUtil.ts";

const ANSWER = [
  "Gemini Models\tWeekly Limit Remaining\t99%\t2026-12-04T09:39:33Z",
  "Gemini Models\tFive Hour Limit Remaining\t42%\t2026-11-27T14:39:33Z",
  "Claude and GPT models\tWeekly Limit Remaining\t100%\t1970-01-01T00:00:00Z",
  "",
].join("\n");

describe("AgyUsageParseUtil.parse", () => {
  it("reads the group, the window, the percent left and the reset time of each line", () => {
    expect(AgyUsageParseUtil.parse(ANSWER).buckets).toStrictEqual([
      { group: "Gemini Models", name: "Weekly Limit Remaining", window: "weekly", remainingPercent: 99, resetsAt: "2026-12-04T09:39:33Z" },
      { group: "Gemini Models", name: "Five Hour Limit Remaining", window: "five_hour", remainingPercent: 42, resetsAt: "2026-11-27T14:39:33Z" },
      { group: "Claude and GPT models", name: "Weekly Limit Remaining", window: "weekly", remainingPercent: 100 },
    ]);
  });

  it("treats the epoch reset time of an unused group as no reset time", () => {
    const [bucket] = AgyUsageParseUtil.parse("A\tWeekly Limit Remaining\t100%\t1970-01-01T00:00:00Z").buckets;
    expect(bucket).not.toHaveProperty("resetsAt");
  });

  it("names a window it does not know as other", () => {
    const [bucket] = AgyUsageParseUtil.parse("A\tDaily Image Limit\t10%\t2026-11-28T00:00:00Z").buckets;
    expect(bucket?.window).toBe("other");
  });

  it("skips lines that are not a limit row, such as a heading", () => {
    const answer = `Usage\n${ANSWER}`;
    expect(AgyUsageParseUtil.parse(answer).buckets).toHaveLength(3);
  });

  it("refuses a percent above 100 and an answer with no limit rows", () => {
    expect(() => AgyUsageParseUtil.parse("A\tWeekly Limit Remaining\t101%\t")).toThrow(AgyOutputError);
    expect(() => AgyUsageParseUtil.parse("not a table")).toThrow(AgyOutputError);
  });
});
