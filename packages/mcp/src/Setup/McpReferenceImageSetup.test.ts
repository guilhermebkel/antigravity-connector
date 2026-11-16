import { describe, expect, it } from "vitest";
import { RemoteImageError, StubImageDownloadUtil, StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from("ffd8ffe000104a46", "hex").toString("base64")}`;
const JPEG_BYTES = Buffer.from("ffd8ffe000104a46", "hex");
const PROMPT = "A red circle on white";
const FAKE_SECRET = "secret-token-9f31c2";

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

  it("AC12: a URL that is not https, and bytes that do not match the declared type, are refused before any run", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: ["http://example.com/a.png"] },
    })).rejects.toThrow(/does not start with https:\/\//);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [JPEG_DATA_URL.replace("image/jpeg", "image/png")] },
    })).rejects.toThrow(/does not match its declared image type/);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });

  it("a value that is neither a data URL nor an https URL is refused, and the message names both forms", async () => {
    const harness = await McpHarnessUtil.start({ respond: buildPng });
    const client = await McpHarnessUtil.connect(harness.address);
    await expect(client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: ["/home/user/photo.png"] },
    })).rejects.toThrow(/base64 data: URL of a PNG, JPEG or WebP image, or an https:\/\/ URL of one/);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });

  it("an https URL is downloaded by the server and reaches agy as an attachment, next to a data URL, in order", async () => {
    const downloads = new StubImageDownloadUtil(() => Promise.resolve(new Uint8Array(JPEG_BYTES)));
    const harness = await McpHarnessUtil.start({ respond: buildPng, imageDownloader: downloads });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [PNG_DATA_URL, "https://photos.example.com/tv.jpg"] },
    });
    expect(result.isError).not.toBe(true);
    expect(downloads.urls).toStrictEqual(["https://photos.example.com/tv.jpg"]);
    expect(harness.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.png", "attachment-2.jpg"]);
    await client.close();
    await harness.app.close();
  });

  it.each([
    ["redirect", /Reference image 1 redirects more than 3 times/],
    ["non_public_address", /Reference image 1 points to an address that is not on the public internet/],
    ["too_large", /Reference image 1 is larger than 4 MiB/],
  ] as const)("a download that fails with %s ends the call as an error that says what to do, and no run starts", async (reason, message) => {
    const downloads = new StubImageDownloadUtil(() => Promise.reject(new RemoteImageError(reason)));
    const harness = await McpHarnessUtil.start({ respond: buildPng, imageDownloader: downloads });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [`https://photos.example.com/tv.jpg?token=${FAKE_SECRET}`] },
    });
    const text = McpHarnessUtil.readFirstText(result);
    expect(result.isError).toBe(true);
    expect(text).toMatch(message);
    expect(text).toMatch(/What to do:/);
    expect(text).not.toContain(FAKE_SECRET);
    expect(text).not.toContain("photos.example.com");
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });

  it("a picture that is not a PNG, JPEG or WebP ends the call as an error, whatever the address says", async () => {
    const downloads = new StubImageDownloadUtil(() => Promise.resolve(new Uint8Array(Buffer.from("<html></html>"))));
    const harness = await McpHarnessUtil.start({ respond: buildPng, imageDownloader: downloads });
    const client = await McpHarnessUtil.connect(harness.address);
    const result = await client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: ["https://photos.example.com/tv.png"] },
    });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toMatch(/is not a PNG, JPEG or WebP picture/);
    expect(harness.requests).toHaveLength(0);
    await client.close();
    await harness.app.close();
  });
});
