import { describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from("ffd8ffe000104a46", "hex").toString("base64")}`;
const PROMPT = "A red circle on white";

const buildPng = (): Promise<StubRunResult> => Promise.resolve({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles: { "output.png": new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")) },
});

describe("generate_image with reference images over MCP", () => {
  it("AC9: up to four reference images are passed to agy as attachments, in order", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [PNG_DATA_URL, JPEG_DATA_URL] },
    });
    expect(result.isError).not.toBe(true);
    const [request] = harness.requests;
    expect(request?.attachmentNames).toStrictEqual(["attachment-1.png", "attachment-2.jpg"]);
    await client.close();
    await harness.app.close();
  });

  it("AC10: a call without images passes no attachments", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    await client.callTool({ name: "generate_image", arguments: { prompt: PROMPT } });
    const [request] = harness.requests;
    expect(request?.attachmentNames).toStrictEqual([]);
    await client.close();
    await harness.app.close();
  });

  it("AC11: more than four images is refused, and no run starts", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [PNG_DATA_URL, PNG_DATA_URL, PNG_DATA_URL, PNG_DATA_URL, PNG_DATA_URL] },
    })).rejects.toThrow(/expected array to have <=4 items/);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });

  it("AC12: a remote URL, and bytes that do not match the declared type, are refused before any run", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: ["https://example.com/a.png"] },
    })).rejects.toThrow(/Remote URLs are not fetched/);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [JPEG_DATA_URL.replace("image/jpeg", "image/png")] },
    })).rejects.toThrow(/does not match its declared image type/);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });
});
