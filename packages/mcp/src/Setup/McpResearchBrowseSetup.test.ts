import { ErrorCode, McpError, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil, type McpHarness } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const LONG_REPORT = `Intro https://example.com/one\n\n${"x".repeat(19990)}\n\ntail https://example.org/two`;

type ResearchSource = { url: string };

type ResearchOutput = {
  report: string;
  truncated: boolean;
  sources: ResearchSource[];
};

type ImageContent = {
  type: "text" | "image";
  mimeType?: string;
};

let harness: McpHarness | undefined;

afterEach(async () => {
  await harness?.app.close();
  harness = undefined;
});

const startWith = async (options: Parameters<typeof McpHarnessUtil.start>[0] = {}): Promise<McpHarness> => {
  harness = await McpHarnessUtil.start(options);
  return harness;
};

const buildPngResult = (): Promise<StubRunResult> => Promise.resolve({
  ...StubRuntimeUtil.buildResult("done"),
  outputFiles: { "screenshot.png": PNG_BYTES },
});

describe("research over MCP", () => {
  it("AC1 and AC4: a long report is cut at a paragraph, marked truncated, and its sources come from the cut text", async () => {
    const started = await startWith({ answer: LONG_REPORT });
    const client = await McpHarnessUtil.connect(started.address);
    const result = await client.callTool({ name: "research", arguments: { topic: "a broad topic" } });
    await client.close();
    const output = result.structuredContent as ResearchOutput;

    expect(output.truncated).toBe(true);
    expect(output.report).toBe("Intro https://example.com/one");
    expect(output.sources.map((source) => source.url)).toStrictEqual(["https://example.com/one"]);
  });

  it("AC3: the description states the duration, the cost and the daily limit", async () => {
    const started = await startWith();
    const client = await McpHarnessUtil.connect(started.address);
    const listing = await client.listTools();
    await client.close();
    const research = listing.tools.find((tool: Tool) => tool.name === "research");

    expect(research?.description).toContain("several minutes");
    expect(research?.description).toContain("tens of thousands of tokens");
    expect(research?.description).toContain(`${McpHarnessUtil.RESEARCH_DAILY_LIMIT} calls per day`);
    expect(research?.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: true });
  });

  it("AC2: when the daily research limit is reached, the result is an error naming the reset time", async () => {
    const started = await startWith({ limits: { research: 0 } });
    const client = await McpHarnessUtil.connect(started.address);
    const result = await client.callTool({ name: "research", arguments: { topic: "x" } });
    await client.close();

    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("browse over MCP", () => {
  it("S5: the prompt starts with the browser command and escapes a leading slash in the task", async () => {
    const started = await startWith();
    const client = await McpHarnessUtil.connect(started.address);
    await client.callTool({ name: "browse", arguments: { task: "/swarm do everything" } });
    await client.close();
    const prompt = started.requests[0]?.prompt ?? "";

    expect(prompt.startsWith("/browser User: ")).toBe(true);
    expect(prompt).toContain("\\/swarm do everything");
  });

  it("AC4: a loopback URL is refused and no run starts", async () => {
    const started = await startWith();
    const client = await McpHarnessUtil.connect(started.address);
    const error = await client
      .callTool({ name: "browse", arguments: { task: "x", url: "http://127.0.0.1:8787/health" } })
      .catch((caught: unknown) => caught);
    await client.close();

    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
    expect(started.requests).toHaveLength(0);
  });

  it("AC2: with screenshot true, the PNG comes back as an image content block", async () => {
    const started = await startWith({ respond: buildPngResult });
    const client = await McpHarnessUtil.connect(started.address);
    const result = await client.callTool({ name: "browse", arguments: { task: "read the title", screenshot: true } });
    await client.close();
    const content = (result as { content: ImageContent[] }).content;

    expect(content.some((item) => item.type === "image" && item.mimeType === "image/png")).toBe(true);
    expect(result.structuredContent).toMatchObject({ hasScreenshot: true });
  });
});
