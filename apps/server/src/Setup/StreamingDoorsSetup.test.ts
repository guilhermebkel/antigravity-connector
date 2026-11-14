import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ProcessProbeUtil } from "@antigravity-connector/server/Testing/ProcessProbeUtil.ts";
import { SERVER_API_KEY, ServerHarnessUtil, type StartedServer } from "@antigravity-connector/server/Testing/ServerHarnessUtil.ts";

type ContentItem = {
  type: "text" | "image";
  data?: string;
};

const FIXTURES = resolve(import.meta.dirname, "../../../../packages/protocol/src/Testing/fixtures");
const CHAT_FIXTURE = join(FIXTURES, "chatEnvelope.json");
const SLOW_TOKEN = "fake-agy:stream-slow";
const SLOW_PROMPT = `[[${SLOW_TOKEN}]] private text`;
const IMAGE_PROMPT = "[[fake-agy:image-png]] a red circle";
const NO_IMAGE_PROMPT = "[[fake-agy:image-none]] a red circle";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const WRAPPER_MODE = 0o755;
const AUTHORIZATION = `Bearer ${SERVER_API_KEY}`;
const MCP_URL_PATH = "/mcp";
const CHAT_URL_PATH = "/v1/chat/completions";
const JSON_CONTENT_TYPE = "application/json";
const NO_PROCESS = 0;
const INTEGRATION_TIMEOUT_MS = 60000;
const HOOK_TIMEOUT_MS = 30000;

const connectMcp = async (address: string): Promise<Client> => {
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${address}${MCP_URL_PATH}`), {
    requestInit: { headers: { authorization: AUTHORIZATION } },
  }));
  return client;
};

const readImageBytes = (result: unknown): Buffer => {
  const { content } = result as { content: ContentItem[] };
  const items = content;
  const block = items.find((item) => item.type === "image");
  return Buffer.from(block?.data ?? "", "base64");
};

describe("streaming, cancellation and images through the server", () => {
  let started: StartedServer | undefined;
  let scratchDirectory: string | undefined;

  afterEach(async () => {
    if (started !== undefined) {
      await ServerHarnessUtil.stop(started);
    }
    started = undefined;
    if (scratchDirectory !== undefined) {
      rmSync(scratchDirectory, { recursive: true, force: true });
    }
    scratchDirectory = undefined;
  }, HOOK_TIMEOUT_MS);

  it("the AI SDK streamText gets the full text and usage from /v1", async () => {
    started = await ServerHarnessUtil.start(ServerHarnessUtil.buildEnv());
    const expected = JSON.parse(readFileSync(CHAT_FIXTURE, "utf8")) as {
      response: string;
      usage: { total_tokens: number };
    };
    const provider = createOpenAICompatible({
      name: "antigravity-connector",
      baseURL: `${started.address}/v1`,
      apiKey: SERVER_API_KEY,
      includeUsage: true,
    });
    const result = streamText({
      model: provider("gemini-3.8-flash"),
      prompt: "[[fake-agy:stream-answer]] Say hello in one word.",
    });
    expect(await result.text).toBe(expected.response);
    expect((await result.usage).totalTokens).toBe(expected.usage.total_tokens);
  }, INTEGRATION_TIMEOUT_MS);

  it("AC5 of #15: a client that disconnects mid-stream kills the agy process", async () => {
    started = await ServerHarnessUtil.start(ServerHarnessUtil.buildEnv());
    const controller = new AbortController();
    const response = await fetch(`${started.address}${CHAT_URL_PATH}`, {
      method: "POST",
      headers: { "content-type": JSON_CONTENT_TYPE, "authorization": AUTHORIZATION },
      body: JSON.stringify({ model: "gemini-3.8-flash", stream: true, messages: [{ role: "user", content: SLOW_PROMPT }] }),
      signal: controller.signal,
    });
    await response.body?.getReader().read();
    await ProcessProbeUtil.waitUntil((count) => count > NO_PROCESS, SLOW_TOKEN, "the slow agy did not start");
    controller.abort();
    await ProcessProbeUtil.waitUntil((count) => count === NO_PROCESS, SLOW_TOKEN, "agy was left running");
    expect(ProcessProbeUtil.countProcesses(SLOW_TOKEN)).toBe(NO_PROCESS);
  }, INTEGRATION_TIMEOUT_MS);

  it("AC4 of #18: a cancelled MCP call kills the agy process", async () => {
    started = await ServerHarnessUtil.start(ServerHarnessUtil.buildEnv());
    const client = await connectMcp(started.address);
    const controller = new AbortController();
    const call = client
      .callTool({ name: "web_search", arguments: { query: SLOW_PROMPT } }, undefined, { signal: controller.signal })
      .catch((error: unknown) => error);
    await ProcessProbeUtil.waitUntil((count) => count > NO_PROCESS, SLOW_TOKEN, "the slow agy did not start");
    controller.abort();
    await ProcessProbeUtil.waitUntil((count) => count === NO_PROCESS, SLOW_TOKEN, "agy was left running after the cancel");
    expect(await call).not.toBeNull();
    await client.close();
  }, INTEGRATION_TIMEOUT_MS);

  it("AC1 and AC3 of #17: generate_image returns a PNG, and a run with no file is a tool error", async () => {
    started = await ServerHarnessUtil.start(ServerHarnessUtil.buildEnv());
    const client = await connectMcp(started.address);
    const image = await client.callTool({ name: "generate_image", arguments: { prompt: IMAGE_PROMPT } });
    expect(image.isError).not.toBe(true);
    const bytes = readImageBytes(image);
    expect([...bytes.subarray(0, PNG_SIGNATURE.length)]).toStrictEqual(PNG_SIGNATURE);
    expect((image.structuredContent as { sizeBytes: number }).sizeBytes).toBe(bytes.byteLength);
    const missing = await client.callTool({ name: "generate_image", arguments: { prompt: NO_IMAGE_PROMPT } });
    expect(missing.isError).toBe(true);
    await client.close();
  }, INTEGRATION_TIMEOUT_MS);

  it("AC5 of #17: a file that is not a PNG is refused and no image is returned", async () => {
    const scratchRoot = join(tmpdir(), "agy-image-test-");
    scratchDirectory = mkdtempSync(scratchRoot);
    const wrapperPath = join(scratchDirectory, "agy-wrapper.sh");
    const envelopePath = join(FIXTURES, "chatEnvelope.json");
    writeFileSync(wrapperPath, ["#!/bin/bash", "printf 'not a png' > output.png", `cat "${envelopePath}"`, ""].join("\n"));
    chmodSync(wrapperPath, WRAPPER_MODE);
    started = await ServerHarnessUtil.start(ServerHarnessUtil.buildEnv({ AGY_BIN: wrapperPath }));
    const client = await connectMcp(started.address);
    const result = await client.callTool({ name: "generate_image", arguments: { prompt: "a circle" } });
    expect(result.isError).toBe(true);
    const items = result.content as ContentItem[];
    const hasImage = items.some((item) => item.type === "image");
    expect(hasImage).toBe(false);
    await client.close();
  }, INTEGRATION_TIMEOUT_MS);
});
