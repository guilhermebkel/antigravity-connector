import type { AgyUsageReport } from "@antigravity-connector/core";
import type { UsageGroup } from "@antigravity-connector/mcp/Protocols/CheckUsageProtocol.ts";

export class UsageReportUtil {
  static buildGroups(report: AgyUsageReport): UsageGroup[] {
    const nameToGroup = new Map<string, UsageGroup>();
    for (const bucket of report.buckets) {
      const group = nameToGroup.get(bucket.group) ?? { name: bucket.group, limits: [] };
      const limit = { name: bucket.name, window: bucket.window, remainingPercent: bucket.remainingPercent };
      group.limits.push(bucket.resetsAt === undefined ? limit : { ...limit, resetsAt: bucket.resetsAt });
      nameToGroup.set(bucket.group, group);
    }
    return [...nameToGroup.values()];
  }

  static buildSummary(groups: readonly UsageGroup[]): string {
    const parts = groups.map((group) => {
      const limits = group.limits.map((limit) => `${limit.name} ${limit.remainingPercent}%`).join(", ");
      return `${group.name}: ${limits}`;
    });
    return `Remaining limits. ${parts.join("; ")}.`;
  }
}
