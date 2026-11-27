import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { CheckUsageInput, CheckUsageOutput } from "@antigravity-connector/mcp/Protocols/CheckUsageProtocol.ts";
import { CheckUsageInputSchema, CheckUsageOutputSchema } from "@antigravity-connector/mcp/Schemas/CheckUsageSchema.ts";
import { UsageReportUtil } from "@antigravity-connector/mcp/Utils/UsageReportUtil.ts";

export class CheckUsageTool implements McpToolPort<CheckUsageInput, CheckUsageOutput> {
  readonly name = "check_usage";

  readonly title = "Check usage";

  readonly description = [
    "Shows how much of the Google AI subscription limits is left, as agy reports it.",
    "Models share their limits in groups, and each group has a 5-hour limit and a weekly limit; for each one the answer gives the percent left and when it refills.",
    "Use it before a long job, or after a call failed because of quota.",
    "It sends no model call and spends no quota, takes about a second, and is cached for 30 seconds.",
    "The server's own daily call limits are separate and are not included.",
  ].join(" ");

  readonly inputSchema = CheckUsageInputSchema;

  readonly outputSchema = CheckUsageOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: true };

  async run(_input: CheckUsageInput, context: McpToolContext): Promise<McpToolRun<CheckUsageOutput>> {
    const snapshot = await context.usageService.read();
    return {
      output: {
        checkedAt: new Date(snapshot.checkedAtMs).toISOString(),
        groups: UsageReportUtil.buildGroups(snapshot.report),
      },
      extraContent: [],
    };
  }

  summarize(output: CheckUsageOutput): string {
    return UsageReportUtil.buildSummary(output.groups);
  }
}
