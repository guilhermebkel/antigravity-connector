import { describe, expect, it } from "vitest";
import { ReportUtil } from "@antigravity-connector/mcp/Utils/ReportUtil.ts";

describe("ReportUtil.truncate", () => {
  it("keeps a report under the cap unchanged", () => {
    expect(ReportUtil.truncate("short report")).toStrictEqual({ text: "short report", isTruncated: false });
  });

  it("AC4: a report over the cap is cut at a paragraph boundary and marked truncated", () => {
    const report = `${"a".repeat(15000)}\n\n${"b".repeat(15000)}`;
    const cut = ReportUtil.truncate(report);

    expect(cut).toStrictEqual({ text: "a".repeat(15000), isTruncated: true });
  });

  it("cuts at the cap when no paragraph boundary is within it", () => {
    const cut = ReportUtil.truncate("c".repeat(ReportUtil.MAX_CHARS + 10));

    expect(cut.text).toHaveLength(ReportUtil.MAX_CHARS);
    expect(cut.isTruncated).toBe(true);
  });
});
