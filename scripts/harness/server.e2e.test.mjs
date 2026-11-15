import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, readFileSync as readFile } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { API_KEY, startServer, stopAllServers } from "./ServerProcess.mjs";

const EVENT_TO_DELTA = { start: 1, end: -1 };
const JSON_CONTENT_TYPE = "application/json";
const SAY_HELLO = "Say hello in one word.";
const FIXTURES = resolve(import.meta.dirname, "../../packages/protocol/src/Testing/fixtures");
const CHAT_ENVELOPE_PATH = join(FIXTURES, "chatEnvelope.json");
const CHAT_ENVELOPE = JSON.parse(readFileSync(CHAT_ENVELOPE_PATH, "utf8"));
const SEARCH_ENVELOPE_PATH = join(FIXTURES, "searchEnvelope.json");
const AUTHORIZATION = `Bearer ${API_KEY}`;
const MODEL = "gemini-3.8-flash";
const CHAT_BODY = { model: MODEL, messages: [{ role: "user", content: SAY_HELLO }] };

describe("the built server, API door", () => {
  let server;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(stopAllServers);

  it("GET /v1/models lists the two model ids", async () => {
    const response = await fetch(`${server.baseUrl}/v1/models`, { headers: { authorization: AUTHORIZATION } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.map((model) => model.id)).toStrictEqual(["gemini-4-argon", "gemini-3.8-flash"]);
  });

  it("a non-streaming chat returns the fixture answer and its usage", async () => {
    const response = await fetch(`${server.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": JSON_CONTENT_TYPE, "authorization": AUTHORIZATION },
      body: JSON.stringify(CHAT_BODY),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.choices[0].message.content).toBe(CHAT_ENVELOPE.response);
    expect(body.usage.total_tokens).toBe(CHAT_ENVELOPE.usage.total_tokens);
  });

  it("a streaming chat through the AI SDK provider returns the text and usage", async () => {
    const provider = createOpenAICompatible({
      name: "antigravity-connector",
      baseURL: `${server.baseUrl}/v1`,
      apiKey: API_KEY,
      includeUsage: true,
    });
    const result = streamText({
      model: provider(MODEL),
      prompt: `[[fake-agy:stream-answer]] ${SAY_HELLO}`,
    });
    expect(await result.text).toBe(CHAT_ENVELOPE.response);
    expect((await result.usage).totalTokens).toBe(CHAT_ENVELOPE.usage.total_tokens);
  });

  it("a request without the bearer is refused with 401", async () => {
    const response = await fetch(`${server.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": JSON_CONTENT_TYPE },
      body: JSON.stringify(CHAT_BODY),
    });
    expect(response.status).toBe(401);
  });
});

describe("the built server, cross-door ordering", () => {
  let scratch;
  let server;

  beforeAll(async () => {
    const scratchRoot = join(tmpdir(), "e2e-order-");
    scratch = mkdtempSync(scratchRoot);
    const logPath = join(scratch, "runs.log");
    const wrapper = join(scratch, "agy-wrapper.sh");
    writeFileSync(wrapper, [
      "#!/bin/bash",
      `echo "start $(date +%s%N)" >> "${logPath}"`,
      "sleep 0.3",
      `cat "${SEARCH_ENVELOPE_PATH}"`,
      `echo "end $(date +%s%N)" >> "${logPath}"`,
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o755);
    server = await startServer({ env: { AGY_BIN: wrapper, QUEUE_CONCURRENCY: "1" } });
  });

  afterAll(async () => {
    await stopAllServers();
    rmSync(scratch, { recursive: true, force: true });
  });

  it("with QUEUE_CONCURRENCY=1, a chat call and a tool call sent together never overlap in agy", async () => {
    const client = new Client({ name: "e2e", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), {
      requestInit: { headers: { authorization: AUTHORIZATION } },
    }));
    const chat = fetch(`${server.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": JSON_CONTENT_TYPE, "authorization": AUTHORIZATION },
      body: JSON.stringify(CHAT_BODY),
    });
    const search = client.callTool({ name: "web_search", arguments: { query: "[[fake-agy:stream-answer]] latest Node LTS" } });
    await Promise.all([chat, search]);
    await client.close();
    const events = readFile(join(scratch, "runs.log"), "utf8").trim().split("\n").map((line) => line.split(" ")[0]);
    let open = 0;
    let maxOpen = 0;
    for (const event of events) {
      open += EVENT_TO_DELTA[event] ?? 0;
      maxOpen = Math.max(maxOpen, open);
    }
    expect(events.filter((event) => event === "start").length).toBeGreaterThanOrEqual(2);
    expect(maxOpen).toBe(1);
  });
});
