import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil, type McpHarness } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

type JobOutput = {
  status: "done" | "running";
  kind: "image" | "web_search" | "research" | "browse";
  jobId: string;
  retryAfterSeconds?: number;
  answer?: string;
};

let harness: McpHarness | undefined;

afterEach(async () => {
  await harness?.app.close();
  harness = undefined;
});

const readStructured = (result: unknown): JobOutput => (result as { structuredContent: JobOutput }).structuredContent;

describe("long tools over MCP as jobs", () => {
  it("AC1: a web search slower than the wait returns a job id, and get_result returns its answer once it is done", async () => {
    let finish: () => void = () => undefined;
    harness = await McpHarnessUtil.start({
      jobWaitMs: 20,
      respond: () => new Promise<StubRunResult>((resolve) => {
        finish = () => {
          resolve(StubRuntimeUtil.buildResult("the answer"));
        };
      }),
    });
    const client = await McpHarnessUtil.connect(harness.address);
    const started = readStructured(await client.callTool({ name: "web_search", arguments: { query: "a question" } }));
    expect(started.status).toBe("running");
    expect(started.kind).toBe("web_search");
    expect(started.retryAfterSeconds).toBe(15);
    finish();
    const done = readStructured(await client.callTool({ name: "get_result", arguments: { job_id: started.jobId } }));
    expect(done.status).toBe("done");
    expect(done.kind).toBe("web_search");
    expect(done.jobId).toBe(started.jobId);
    expect(done.answer).toBe("the answer");
    await client.close();
  });

  it("AC2: a fast web search returns its answer in the same call, with no job to fetch", async () => {
    harness = await McpHarnessUtil.start({ respond: () => Promise.resolve(StubRuntimeUtil.buildResult("quick")) });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = readStructured(await client.callTool({ name: "web_search", arguments: { query: "a question" } }));
    expect(result.status).toBe("done");
    expect(result.answer).toBe("quick");
    await client.close();
  });

  it("AC3: get_result with an unknown job id is a tool error", async () => {
    harness = await McpHarnessUtil.start();
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "get_result", arguments: { job_id: randomUUID() } });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("no job has this job_id");
    await client.close();
  });
});
