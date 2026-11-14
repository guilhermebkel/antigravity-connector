import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { McpSetup } from "@antigravity-connector/mcp/Setup/McpSetup.ts";
import { StubRuntimeUtil, type StubRunOptions, type StubRunRequest } from "@antigravity-connector/core";

const API_KEY = "test-api-key-0123456789abcdef";
const MCP_PATH = "/mcp";
const DAY_MS = 86400000;
const STRUCTURED_SOURCE_URL = "https://nodejs.org/en/about/previous-releases";

type Harness = {
  app: FastifyInstance;
  address: string;
  requests: StubRunRequest[];
  clock: { now: number };
};

type StructuredAnswer = {
  answer: string;
  sources: { url: string }[];
};

const readFirstText = (result: unknown): string => {
  const { content } = result as { content: { text?: string }[] };
  return content[0]?.text ?? "";
};

type HarnessExtras = {
  maxSessions?: number;
  sessionTtlMs?: number;
};

type HarnessOptions = StubRunOptions & HarnessExtras;

const startHarness = async (options: HarnessOptions = {}): Promise<Harness> => {
  const stub = StubRuntimeUtil.build(options);
  const clock = { now: 0 };
  const app = Fastify({ logger: false });
  McpSetup.register(app, {
    clock: () => clock.now,
    runService: stub.runService,
    sessionTtlMs: options.sessionTtlMs ?? DAY_MS,
    maxSessions: options.maxSessions ?? 8,
    researchDailyLimit: 5,
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  return { app, address, clock, requests: stub.requests };
};

const connectClient = async (address: string): Promise<Client> => {
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${address}${MCP_PATH}`), {
    requestInit: { headers: { authorization: `Bearer ${API_KEY}` } },
  });
  await client.connect(transport);
  return client;
};

describe("McpSetup", () => {
  let harness: Harness | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => undefined);
    await harness?.app.close();
    client = undefined;
    harness = undefined;
  });

  it("AC1: initialize returns the instructions, and tools/list has web_search with both schemas", async () => {
    harness = await startHarness();
    client = await connectClient(harness.address);
    expect(client.getInstructions()).toContain("subscription");
    const { tools } = await client.listTools();
    const webSearch = tools.find((tool) => tool.name === "web_search");
    expect(typeof webSearch?.inputSchema).toBe("object");
    expect(typeof webSearch?.outputSchema).toBe("object");
  });

  it("AC2: web_search returns structured content with answer and sources, and the same data as text", async () => {
    harness = await startHarness();
    client = await connectClient(harness.address);
    const result = await client.callTool({ name: "web_search", arguments: { query: "latest Node LTS" } });
    const structured = result.structuredContent as StructuredAnswer;
    expect(structured.answer).toBe(StubRuntimeUtil.DEFAULT_ANSWER);
    expect(structured.sources.map((source) => source.url)).toStrictEqual([STRUCTURED_SOURCE_URL]);
    expect(readFirstText(result)).toContain(structured.answer);
  });

  it("AC4: the daily search limit returns a tool error that names the reset time", async () => {
    harness = await startHarness({ limits: { search: 1 } });
    client = await connectClient(harness.address);
    await client.callTool({ name: "web_search", arguments: { query: "first" } });
    const result = await client.callTool({ name: "web_search", arguments: { query: "second" } });
    expect(result.isError).toBe(true);
    expect(readFirstText(result)).toContain("resets at");
  });

  it("AC6: one more initialize over the session cap returns 503", async () => {
    harness = await startHarness({ maxSessions: 1 });
    client = await connectClient(harness.address);
    const response = await fetch(`${harness.address}${MCP_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "second", version: "0.0.0" } },
      }),
    });
    expect(response.status).toBe(503);
  });

  it("AC7: a session idle past its TTL answers 404 on its next request", async () => {
    harness = await startHarness({ sessionTtlMs: DAY_MS });
    client = await connectClient(harness.address);
    const sessionId = client.transport?.sessionId ?? "";
    harness.clock.now += DAY_MS;
    const response = await fetch(`${harness.address}${MCP_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "authorization": `Bearer ${API_KEY}`,
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    expect(response.status).toBe(404);
  });

  it("AC8: an empty query is an invalid-params protocol error and no run starts", async () => {
    harness = await startHarness();
    client = await connectClient(harness.address);
    const error = await client
      .callTool({ name: "web_search", arguments: { query: "   " } })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
    expect(harness.requests).toHaveLength(0);
  });

  it("AC9: a login_required session returns a tool error without the login URL", async () => {
    harness = await startHarness({ sessionKind: "login_required" });
    client = await connectClient(harness.address);
    const result = await client.callTool({ name: "web_search", arguments: { query: "anything" } });
    expect(result.isError).toBe(true);
    const text = readFirstText(result);
    expect(text).toContain("container logs");
    expect(text).not.toContain("accounts.google.com");
  });
});
