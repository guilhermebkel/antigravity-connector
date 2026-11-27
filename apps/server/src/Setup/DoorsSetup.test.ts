import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateText } from "ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { EnvUtil, type Env } from "@antigravity-connector/core";
import { ServerSetup, type RunningServer } from "@antigravity-connector/server/Setup/ServerSetup.ts";

const API_KEY = "test-api-key-0123456789abcdef";
const FAKE_AGY = resolve(import.meta.dirname, "../../../../packages/agy/src/Testing/FakeAgy.mjs");
const FIXTURES_DIRECTORY = resolve(import.meta.dirname, "../../../../packages/protocol/src/Testing/fixtures");
const CHAT_FIXTURE = join(FIXTURES_DIRECTORY, "chatEnvelope.json");
const SEARCH_FIXTURE = join(FIXTURES_DIRECTORY, "searchEnvelope.json");
const SESSION_HEADER = "mcp-session-id";
const CHAT_PATH = "/v1/chat/completions";
const SHUTDOWN_GRACE_MS = 2000;
const RUN_TIMEOUT_MS = 60000;
const SLOW_AGY_MS = 300;
const START_MARK = "start";
const END_MARK = "end";
const WRAPPER_MODE = 0o755;

const buildEnv = (overrides: Record<string, string> = {}): Env => EnvUtil.load({
  API_KEY,
  AGY_BIN: FAKE_AGY,
  AGY_TIMEOUT_MS: String(RUN_TIMEOUT_MS),
  ...overrides,
});

type RunningAddress = {
  server: RunningServer;
  address: string;
};

const startServer = async (env: Env): Promise<RunningAddress> => {
  const server = await ServerSetup.build({
    env,
    parentEnv: { API_KEY, PATH: EnvUtil.readProcessEnv().PATH ?? "" },
    logSink: () => undefined,
    clock: Date.now,
    createRoutePlugins: (runtime) => ServerSetup.buildDoors(runtime, env, Date.now),
  });
  const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
  return { server, address };
};

type HeaderNameToValue = Record<string, string>;

const postJson = (url: string, headers: HeaderNameToValue, body: unknown): Promise<Response> => fetch(url, {
  headers,
  method: "POST",
  body: JSON.stringify(body),
});

const MCP_HEADERS = {
  "accept": "application/json, text/event-stream",
  "content-type": "application/json",
};

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } },
};

describe("the two doors on the server", () => {
  let running: RunningServer | undefined;
  let scratchDirectory: string | undefined;

  afterEach(async () => {
    if (running !== undefined) {
      await ServerSetup.stopServer(running, SHUTDOWN_GRACE_MS);
    }
    running = undefined;
    if (scratchDirectory !== undefined) {
      rmSync(scratchDirectory, { recursive: true, force: true });
    }
    scratchDirectory = undefined;
  });

  it("AC3 of issue 16: /mcp with a valid session id and a wrong bearer returns 401", async () => {
    const started = await startServer(buildEnv());
    running = started.server;
    const initialized = await postJson(
      `${started.address}/mcp`,
      { ...MCP_HEADERS, authorization: `Bearer ${API_KEY}` },
      initializeBody,
    );
    expect(initialized.status).toBe(200);
    const sessionId = initialized.headers.get(SESSION_HEADER) ?? "";
    expect(sessionId).not.toBe("");
    const wrong = await postJson(
      `${started.address}/mcp`,
      { ...MCP_HEADERS, [SESSION_HEADER]: sessionId, authorization: `Bearer ${API_KEY}x` },
      { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
    );
    expect(wrong.status).toBe(401);
  });

  it("a link made through the keyed /mcp door takes a picture with no key, and the link works once", async () => {
    const started = await startServer(buildEnv());
    running = started.server;
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${started.address}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${API_KEY}` } },
    }));
    const result = await client.callTool({ name: "create_upload_link", arguments: {} });
    const { uploadPath, image } = result.structuredContent as {
      uploadPath: string;
      image: string;
    };
    const picture = Buffer.from("ffd8ffe000104a46", "hex");
    const first = await fetch(`${started.address}${uploadPath}`, { method: "POST", body: picture });
    expect(await first.json()).toStrictEqual({ image, file: image, kind: "image", mimeType: "image/jpeg", sizeBytes: 8 });
    const second = await fetch(`${started.address}${uploadPath}`, { method: "POST", body: picture });
    expect(second.status).toBe(404);
    await client.close();
  });

  it("AC5 of issue 16: with QUEUE_CONCURRENCY=1, an MCP call and an API chat call never overlap in agy", async () => {
    const scratchRoot = join(tmpdir(), "agy-order-test-");
    scratchDirectory = mkdtempSync(scratchRoot);
    const logPath = join(scratchDirectory, "runs.log");
    const wrapperPath = join(scratchDirectory, "agy-wrapper.sh");
    writeFileSync(wrapperPath, [
      "#!/bin/bash",
      `echo "${START_MARK} $(date +%s%N)" >> "${logPath}"`,
      `sleep ${SLOW_AGY_MS / 1000}`,
      `cat "${SEARCH_FIXTURE}"`,
      `echo "${END_MARK} $(date +%s%N)" >> "${logPath}"`,
      "",
    ].join("\n"));
    chmodSync(wrapperPath, WRAPPER_MODE);
    const started = await startServer(buildEnv({ AGY_BIN: wrapperPath, QUEUE_CONCURRENCY: "1" }));
    running = started.server;
    const initialized = await postJson(
      `${started.address}/mcp`,
      { ...MCP_HEADERS, authorization: `Bearer ${API_KEY}` },
      initializeBody,
    );
    const sessionId = initialized.headers.get(SESSION_HEADER) ?? "";
    const mcpCall = postJson(
      `${started.address}/mcp`,
      { ...MCP_HEADERS, [SESSION_HEADER]: sessionId, authorization: `Bearer ${API_KEY}` },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "web_search", arguments: { query: "latest Node LTS" } } },
    );
    const apiCall = postJson(
      `${started.address}${CHAT_PATH}`,
      { "content-type": "application/json", "authorization": `Bearer ${API_KEY}` },
      { model: "gemini-3.8-flash", messages: [{ role: "user", content: "Say hello in one word." }] },
    );
    await Promise.all([mcpCall, apiCall]);
    const logText = readFileSync(logPath, "utf8");
    const events = logText.trim().split("\n").map((line) => line.split(" ")[0]);
    let openRuns = 0;
    let maxOpenRuns = 0;
    for (const event of events) {
      openRuns += event === START_MARK ? 1 : -1;
      maxOpenRuns = Math.max(maxOpenRuns, openRuns);
    }
    expect(events.filter((event) => event === START_MARK).length).toBeGreaterThanOrEqual(2);
    expect(maxOpenRuns).toBe(1);
  });

  it("the AI SDK openai-compatible provider gets the answer and usage from /v1", async () => {
    const started = await startServer(buildEnv());
    running = started.server;
    const expected = JSON.parse(readFileSync(CHAT_FIXTURE, "utf8")) as {
      response: string;
      usage: { total_tokens: number };
    };
    const provider = createOpenAICompatible({
      name: "antigravity-connector",
      baseURL: `${started.address}/v1`,
      apiKey: API_KEY,
    });
    const result = await generateText({ model: provider("gemini-3.8-flash"), prompt: "Say hello in one word." });
    expect(result.text).toBe(expected.response);
    expect(result.usage.totalTokens).toBe(expected.usage.total_tokens);
  });
});
