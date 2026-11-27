import { describe, expect, it } from "vitest";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

type UsageLimit = {
  name: string;
  window: string;
  remainingPercent: number;
  resetsAt?: string;
};

type UsageGroup = {
  name: string;
  limits: UsageLimit[];
};

type UsageOutput = {
  checkedAt: string;
  groups: UsageGroup[];
};

describe("check_usage over MCP", () => {
  it("is listed, read-only, and returns the limits grouped by model group", async () => {
    const harness = await McpHarnessUtil.start();
    const client = await McpHarnessUtil.connect(harness.address);
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === "check_usage")?.annotations?.readOnlyHint).toBe(true);

    const result = await client.callTool({ name: "check_usage", arguments: {} });
    const output = result.structuredContent as UsageOutput;

    expect(result.isError).not.toBe(true);
    expect(output.groups.map((group) => group.name)).toStrictEqual(["Gemini Models", "Claude and GPT models"]);
    expect(output.groups[0]?.limits[1]).toStrictEqual({
      name: "Five Hour Limit Remaining",
      window: "five_hour",
      remainingPercent: 42,
      resetsAt: "2026-11-27T14:39:33Z",
    });
    expect(output.groups[1]?.limits[0]).not.toHaveProperty("resetsAt");
    expect(McpHarnessUtil.readFirstText(result)).toContain("Gemini Models: Weekly Limit Remaining 99%");
    await client.close();
    await harness.app.close();
  });

  it("starts no agy run and spends no daily limit", async () => {
    const harness = await McpHarnessUtil.start({ limits: { chat: 0, media: 0, image: 0 } });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "check_usage", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });
});
