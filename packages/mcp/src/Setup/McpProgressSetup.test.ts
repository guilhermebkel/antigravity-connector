import { describe, expect, it } from "vitest";
import type { Progress } from "@modelcontextprotocol/sdk/types.js";
import { StubRuntimeUtil } from "@antigravity-connector/core";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const MARKER = "private-marker-7731";
const WAIT_POLL_MS = 10;
const WAIT_LIMIT = 500;

const waitUntil = async (isReady: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < WAIT_LIMIT; attempt += 1) {
    if (isReady()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, WAIT_POLL_MS);
    });
  }
  throw new Error("the condition was not reached in time");
};

describe("McpSetup progress", () => {
  it("AC1: a waiting notification comes before the started one when another call holds the queue", async () => {
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = await McpHarnessUtil.start({
      respond: async () => {
        await blocker;
        return StubRuntimeUtil.buildResult("done");
      },
    });
    const holder = await McpHarnessUtil.connect(harness.address);
    const waiter = await McpHarnessUtil.connect(harness.address);
    const holding = holder.callTool({ name: "web_search", arguments: { query: "first" } });
    await waitUntil(() => harness.requests.length === 1);
    const messages: string[] = [];
    const collectProgress = (progress: Progress): void => {
      messages.push(progress.message ?? "");
    };
    const waiting = waiter.callTool(
      { name: "web_search", arguments: { query: "second" } },
      undefined,
      { onprogress: collectProgress },
    );
    await waitUntil(() => messages.length >= 1);
    release();
    await holding;
    await waiting;
    expect(messages[0]).toMatch(/^Waiting in the agy queue at position 1/);
    expect(messages.some((message) => message === "Started the run.")).toBe(true);
    expect(messages.findIndex((message) => message === "Started the run.")).toBeGreaterThan(0);
    await holder.close();
    await waiter.close();
    await harness.app.close();
  });

  it("AC2: without a progress token the result is the same and no progress is sent", async () => {
    const harness = await McpHarnessUtil.start({ answer: "Node.js 26 is the current LTS." });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "web_search", arguments: { query: "latest Node LTS" } });
    expect((result.structuredContent as { answer: string }).answer).toBe("Node.js 26 is the current LTS.");
    await client.close();
    await harness.app.close();
  });

  it("AC5: no progress message contains the query", async () => {
    const harness = await McpHarnessUtil.start();
    const client = await McpHarnessUtil.connect(harness.address);
    const messages: string[] = [];
    await client.callTool(
      { name: "web_search", arguments: { query: MARKER } },
      undefined,
      { onprogress: (progress) => messages.push(progress.message ?? "") },
    );
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.includes(MARKER))).toBe(false);
    await client.close();
    await harness.app.close();
  });
});
