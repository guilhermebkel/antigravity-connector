import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRuntime } from "@antigravity-connector/core";
import { ApiSetup } from "@antigravity-connector/api/Setup/ApiSetup.ts";

const API_KEY_HEADER = { "content-type": "application/json", "authorization": "Bearer test-api-key-0123456789abcdef" };
const CHAT_PATH = "/v1/chat/completions";
const ANSWER = "Pong! How can I help you today?\n";
const DONE_LINE = "data: [DONE]";
const KEEP_ALIVE_LINE = ": keep-alive";
const SHORT_KEEP_ALIVE_MS = 20;
const POLL_MS = 5;
const POLL_LIMIT = 400;
const RELEASE_SETTLE_MS = 50;

type SseDelta = {
  role?: "assistant";
  content?: string;
};

type SseChoice = {
  delta: SseDelta;
  finish_reason: string | null;
};

type SseChunk = {
  choices: SseChoice[];
  usage?: { total_tokens: number };
};

const buildBody = (overrides: Record<string, unknown> = {}): string => JSON.stringify({
  model: "gemini-3.8-flash",
  stream: true,
  messages: [{ role: "user", content: "Say hello in one word." }],
  ...overrides,
});

const readDataLines = (body: string): string[] => body
  .split("\n")
  .filter((line) => line.startsWith("data: "))
  .map((line) => line.slice("data: ".length));

type ErrorDetail = { code: string };

type ErrorBody = { error: ErrorDetail };

type PlainMessage = { content: string };

type PlainChoice = { message: PlainMessage };

type PlainBody = { choices: PlainChoice[] };

const readChunks = (body: string): SseChunk[] => readDataLines(body)
  .filter((data) => data !== "[DONE]")
  .map((data) => JSON.parse(data) as SseChunk);

const buildApp = async (runtime: StubRuntime, keepAliveMs = ApiSetup.KEEP_ALIVE_MS): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  ApiSetup.register(app, { runService: runtime.runService, clock: () => 1700000000000, keepAliveMs });
  await app.ready();
  return app;
};

const waitFor = async (isReady: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    if (isReady()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, POLL_MS);
    });
  }
  throw new Error("the condition was not reached in time");
};

describe("ApiSetup streaming", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("AC1: the concatenated deltas equal the text of the non-streaming call", async () => {
    app = await buildApp(StubRuntimeUtil.build({ answer: ANSWER }));
    const streamed = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildBody() });
    expect(streamed.statusCode).toBe(200);
    expect(streamed.headers["content-type"]).toContain("text/event-stream");
    const text = readChunks(streamed.body).map((chunk) => chunk.choices[0]?.delta.content ?? "").join("");
    const plainBody = buildBody({ stream: false });
    const plain = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: plainBody,
    });
    expect(text).toBe(ANSWER);
    const parsedPlain = JSON.parse(plain.body) as PlainBody;
    expect(parsedPlain.choices[0]?.message.content).toBe(text);
  });

  it("S1 and S2: the first chunk carries the role, the last text chunk finishes with stop, and [DONE] ends it", async () => {
    app = await buildApp(StubRuntimeUtil.build({ answer: ANSWER }));
    const body = buildBody();
    const response = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: body });
    const chunks = readChunks(response.body);
    const firstDelta = chunks[0]?.choices[0]?.delta;
    expect(firstDelta?.role).toBe("assistant");
    const finish = chunks.find((chunk) => chunk.choices[0]?.finish_reason === "stop");
    expect(finish?.choices[0]?.finish_reason).toBe("stop");
    expect(response.body.trimEnd().endsWith(DONE_LINE)).toBe(true);
  });

  it("AC2: exactly one usage chunk, after the finish chunk and before [DONE]", async () => {
    app = await buildApp(StubRuntimeUtil.build({ answer: ANSWER }));
    const response = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildBody({ stream_options: { include_usage: true } }),
    });
    const chunks = readChunks(response.body);
    const usageIndexes = chunks
      .map((chunk, index) => (chunk.usage === undefined ? -1 : index))
      .filter((index) => index >= 0);
    const finishIndex = chunks.findIndex((chunk) => chunk.choices[0]?.finish_reason === "stop");
    expect(usageIndexes).toHaveLength(1);
    expect(usageIndexes[0]).toBeGreaterThan(finishIndex);
    expect(chunks[usageIndexes[0] ?? 0]?.usage?.total_tokens).toBe(StubRuntimeUtil.USAGE.total_tokens);
    const lines = response.body.trimEnd().split("\n");
    expect(lines[lines.length - 1]).toBe(DONE_LINE);
  });

  it("AC3: the daily limit answers with a JSON 429, not an event stream", async () => {
    app = await buildApp(StubRuntimeUtil.build({ limits: { chat: 0 } }));
    const response = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildBody() });
    expect(response.statusCode).toBe(429);
    expect(response.headers["content-type"]).toContain("application/json");
    const limitBody = JSON.parse(response.body) as ErrorBody;
    expect(limitBody.error.code).toBe("daily_limit_reached");
  });

  it("AC4: an agy failure after two deltas sends two chunks, one error event, and no [DONE]", async () => {
    app = await buildApp(StubRuntimeUtil.build({ answer: ANSWER, failAfterDeltas: 2 }));
    const response = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildBody() });
    const dataLines = readDataLines(response.body);
    const deltas = dataLines.filter((data) => data !== "[DONE]" && !data.startsWith("{\"error\""));
    expect(deltas).toHaveLength(2);
    const errors = dataLines.filter((data) => data.startsWith("{\"error\""));
    expect(errors).toHaveLength(1);
    expect(JSON.parse(errors[0] ?? "{}")).toMatchObject({ error: { code: "agy_failed", type: "server_error" } });
    expect(response.body).not.toContain(DONE_LINE);
  });

  it("AC6: a call that waits in the queue gets a keep-alive comment before its first chunk", async () => {
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runtime = StubRuntimeUtil.build({
      answer: ANSWER,
      respond: async () => {
        await blocker;
        return StubRuntimeUtil.buildResult(ANSWER);
      },
    });
    app = Fastify({ logger: false });
    ApiSetup.register(app, { runService: runtime.runService, clock: () => 0, keepAliveMs: SHORT_KEEP_ALIVE_MS });
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const holder = fetch(`${address}${CHAT_PATH}`, { method: "POST", headers: API_KEY_HEADER, body: buildBody({ stream: false }) });
    await waitFor(() => runtime.requests.length === 1);
    const waiting = await fetch(`${address}${CHAT_PATH}`, { method: "POST", headers: API_KEY_HEADER, body: buildBody() });
    const reader = waiting.body?.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes(KEEP_ALIVE_LINE)) {
      const next = await reader?.read();
      if (next?.value !== undefined) {
        text += decoder.decode(next.value as Uint8Array);
      }
    }
    release();
    await holder;
    await new Promise((resolve) => {
      setTimeout(resolve, RELEASE_SETTLE_MS);
    });
    expect(text).toContain(KEEP_ALIVE_LINE);
    expect(text).not.toContain("data: ");
  });
});
