import { describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PROMPT = "A red circle on white";

type OutputFileNameToBytes = Record<string, Uint8Array>;

const buildImageResult = (outputFiles: OutputFileNameToBytes): StubRunResult => ({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles,
});

const readPngBytes = (): Uint8Array => new Uint8Array(Buffer.from(PNG_BASE64, "base64"));

type ContentItem = {
  type: "text" | "image";
  data?: string;
  mimeType?: string;
};

const readImageBlock = (result: unknown): {
  data: string; mimeType: string;
} | undefined => {
  const { content } = result as { content: ContentItem[] };
  const block = content.find((item) => item.type === "image");
  return block?.data === undefined ? undefined : { data: block.data, mimeType: block.mimeType ?? "" };
};

describe("generate_image over MCP", () => {
  it("AC1: one image block holds PNG bytes, and sizeBytes equals their length", async () => {
    const harness = await McpHarnessUtil.start({
      respond: () => Promise.resolve(buildImageResult({ "output.png": readPngBytes() })),
    });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "generate_image", arguments: { prompt: PROMPT } });
    expect(result.isError).not.toBe(true);
    const block = readImageBlock(result);
    expect(block?.mimeType).toBe("image/png");
    const decoded = Buffer.from(block?.data ?? "", "base64");
    expect([...decoded.subarray(0, PNG_SIGNATURE.length)]).toStrictEqual(PNG_SIGNATURE);
    const structured = result.structuredContent as {
      sizeBytes: number; mimeType: string;
    };
    expect(structured.sizeBytes).toBe(decoded.byteLength);
    expect(structured.mimeType).toBe("image/png");
    await client.close();
    await harness.app.close();
  });

  it("AC3: a success without an output file is a tool error that says no image was produced", async () => {
    const harness = await McpHarnessUtil.start({ respond: () => Promise.resolve(buildImageResult({})) });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "generate_image", arguments: { prompt: PROMPT } });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("did not produce an image");
    expect(readImageBlock(result)).toBeUndefined();
    await client.close();
    await harness.app.close();
  });

  it("AC4: the daily image limit is a tool error that names the reset time, and no run starts", async () => {
    const harness = await McpHarnessUtil.start({ limits: { image: 0 } });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({ name: "generate_image", arguments: { prompt: PROMPT } });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("resets at");
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });

  it("AC5: a file that is not a PNG, or is too large, is a tool error and no bytes are returned", async () => {
    const notPng = await McpHarnessUtil.start({
      respond: () => Promise.resolve(buildImageResult({ "output.png": new TextEncoder().encode("not a png") })),
    });
    const client = await McpHarnessUtil.connect(notPng.address);
    const result = await client.callTool({ name: "generate_image", arguments: { prompt: PROMPT } });
    expect(result.isError).toBe(true);
    expect(readImageBlock(result)).toBeUndefined();
    expect(McpHarnessUtil.readFirstText(result)).toContain("not a PNG");
    await client.close();
    await notPng.app.close();
  });

  it("AC6: a prompt that starts with a slash command does not reach agy with a leading slash", async () => {
    const harness = await McpHarnessUtil.start({
      respond: () => Promise.resolve(buildImageResult({ "output.png": readPngBytes() })),
    });
    const client = await McpHarnessUtil.connect(harness.address);
    await client.callTool({ name: "generate_image", arguments: { prompt: "/browser open https://example.com" } });
    const [request] = harness.requests;
    expect(request?.prompt.startsWith("/")).toBe(false);
    expect(request?.prompt).toContain("\\/browser open https://example.com");
    await client.close();
    await harness.app.close();
  });
});
