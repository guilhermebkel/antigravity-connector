import { afterEach, describe, expect, it } from "vitest";
import { StubLoginPort } from "@antigravity-connector/core";
import { McpHarnessUtil, type McpHarness } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

let harness: McpHarness | undefined;

afterEach(async () => {
  await harness?.app.close();
  harness = undefined;
});

describe("check_auth and set_auth over MCP", () => {
  it("check_auth returns the login link when login is required, and set_auth connects with the code", async () => {
    harness = await McpHarnessUtil.start({ sessionKind: "login_required" });
    const client = await McpHarnessUtil.connect(harness.address);
    const check = await client.callTool({ name: "check_auth", arguments: {} });
    const connected = await client.callTool({ name: "set_auth", arguments: { code: StubLoginPort.GOOD_CODE } });
    await client.close();

    expect(check.structuredContent).toMatchObject({ status: "login_required", login_url: StubLoginPort.LOGIN_URL });
    expect(connected.structuredContent).toMatchObject({ status: "connected" });
  });

  it("set_auth without a started login is an error that tells the client to call check_auth", async () => {
    harness = await McpHarnessUtil.start({ sessionKind: "login_required" });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "set_auth", arguments: { code: "anything" } });
    await client.close();

    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("check_auth");
  });

  it("the tool list offers check_auth and set_auth with both schemas", async () => {
    harness = await McpHarnessUtil.start();
    const client = await McpHarnessUtil.connect(harness.address);
    const listing = await client.listTools();
    await client.close();
    const names = listing.tools.map((tool) => tool.name);

    expect(names).toContain("check_auth");
    expect(names).toContain("set_auth");
    for (const tool of listing.tools.filter((item) => item.name.endsWith("_auth"))) {
      expect(typeof tool.inputSchema).toBe("object");
      expect(typeof tool.outputSchema).toBe("object");
    }
  });
});
