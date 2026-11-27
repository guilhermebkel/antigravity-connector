import type { AgyUsagePort, AgyUsageReport } from "@antigravity-connector/agy";

export class StubUsageUtil {
  static readonly REPORT: AgyUsageReport = {
    buckets: [
      { group: "Gemini Models", name: "Weekly Limit Remaining", window: "weekly", remainingPercent: 99, resetsAt: "2026-12-04T09:39:33Z" },
      { group: "Gemini Models", name: "Five Hour Limit Remaining", window: "five_hour", remainingPercent: 42, resetsAt: "2026-11-27T14:39:33Z" },
      { group: "Claude and GPT models", name: "Weekly Limit Remaining", window: "weekly", remainingPercent: 100 },
    ],
  };

  static buildPort(): AgyUsagePort & { reads: number } {
    const port = {
      reads: 0,
      read: (): Promise<AgyUsageReport> => {
        port.reads += 1;
        return Promise.resolve(StubUsageUtil.REPORT);
      },
    };
    return port;
  }
}
