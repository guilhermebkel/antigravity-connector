import { connect, type Socket } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { ChatCompletionResponse, ModelList, OpenAiErrorType } from "@antigravity-connector/protocol";
import { ApiSetup } from "@antigravity-connector/api/Setup/ApiSetup.ts";
import { StubRuntimeUtil, type StubRunRequest, type StubRuntime, type StubSessionKind } from "@antigravity-connector/core";

type ErrorBody = {
  error: {
    message: string;
    type: OpenAiErrorType;
    param: string | null;
    code: string | null;
  };
};

const API_KEY = "test-api-key-0123456789abcdef";
const API_KEY_HEADER = { "content-type": "application/json", "authorization": `Bearer ${API_KEY}` };
const CHAT_PATH = "/v1/chat/completions";
const IGNORED_HEADER = "x-antigravity-connector-ignored-params";
const CLOCK_MS = 1700000000000;
const DISCONNECT_SETTLE_MS = 50;
const POLL_MS = 5;
const POLL_LIMIT = 400;

const readErrorBody = (response: { body: string }): ErrorBody => JSON.parse(response.body) as ErrorBody;

const readChatBody = (response: { body: string }): ChatCompletionResponse => {
  return JSON.parse(response.body) as ChatCompletionResponse;
};

const readModelList = (response: { body: string }): ModelList => JSON.parse(response.body) as ModelList;

const buildChatBody = (overrides: Record<string, unknown> = {}): string => JSON.stringify({
  model: "gemini-3.8-flash",
  messages: [{ role: "user", content: "Say hello in one word." }],
  ...overrides,
});

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

type RawChatState = {
  socket: Socket;
  written: boolean;
};

const sendRawChat = (port: number): RawChatState => {
  const payload = buildChatBody();
  const socket = connect(port, "127.0.0.1");
  const state = { socket, written: false };
  socket.on("connect", () => {
    socket.write([
      `POST ${CHAT_PATH} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      `authorization: Bearer ${API_KEY}`,
      "content-type: application/json",
      `content-length: ${Buffer.byteLength(payload)}`,
      "connection: close",
      "",
      payload,
    ].join("\r\n"));
    state.written = true;
  });
  socket.on("error", () => undefined);
  return state;
};

const buildApp = async (runtime: StubRuntime): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  ApiSetup.register(app, { runService: runtime.runService, clock: () => CLOCK_MS });
  await app.ready();
  return app;
};

const buildSessionApp = (sessionKind: StubSessionKind): Promise<FastifyInstance> => {
  return buildApp(StubRuntimeUtil.build({ sessionKind }));
};

describe("ApiSetup", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("AC1: a valid request returns a chat.completion with the envelope's text and usage", async () => {
    app = await buildApp(StubRuntimeUtil.build({ respond: () => Promise.resolve(StubRuntimeUtil.buildResult("Hello.")) }));
    const response = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(response.statusCode).toBe(200);
    const body = readChatBody(response);
    expect(body.object).toBe("chat.completion");
    expect(body.choices[0]?.message.content).toBe("Hello.");
    expect(body.choices[0]?.finish_reason).toBe("stop");
    expect(body.usage.total_tokens).toBe(StubRuntimeUtil.USAGE.total_tokens);
    expect(body.conversation_id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("AC2: GET /v1/models lists exactly the two model ids", async () => {
    app = await buildApp(StubRuntimeUtil.build());
    const response = await app.inject({ method: "GET", url: "/v1/models", headers: API_KEY_HEADER });
    expect(response.statusCode).toBe(200);
    const ids = readModelList(response).data.map((model) => model.id);
    expect(ids).toStrictEqual(["gemini-4-argon", "gemini-3.8-flash"]);
  });

  it("AC3: tools with one function return 400 tools_not_supported and no run starts", async () => {
    const runtime = StubRuntimeUtil.build();
    app = await buildApp(runtime);
    const tools = [{ type: "function", function: { name: "lookup", parameters: {} } }];
    const response = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ tools }),
    });
    expect(response.statusCode).toBe(400);
    expect(readErrorBody(response).error.code).toBe("tools_not_supported");
    expect(runtime.requests).toHaveLength(0);
  });

  it("AC4: ignored sampling parameters still return 200 and are listed in the header", async () => {
    app = await buildApp(StubRuntimeUtil.build());
    const response = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ temperature: 0.2, max_tokens: 100 }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers[IGNORED_HEADER]).toBe("temperature,max_tokens");
  });

  it("AC5: the daily chat limit returns 429 daily_limit_reached with the reset time", async () => {
    app = await buildApp(StubRuntimeUtil.build({ limits: { chat: 1 } }));
    const first = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(second.statusCode).toBe(429);
    const error = readErrorBody(second).error;
    expect(error.code).toBe("daily_limit_reached");
    expect(error.message).toContain("resets at");
  });

  it("AC6: login_required returns 503 agy_session_required without the login URL", async () => {
    app = await buildSessionApp("login_required");
    const response = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(response.statusCode).toBe(503);
    expect(readErrorBody(response).error.code).toBe("agy_session_required");
    expect(response.body).not.toContain("accounts.google.com");
  });

  it("AC7: a system message and three turns reach the run in order", async () => {
    const seen: StubRunRequest[] = [];
    app = await buildApp(StubRuntimeUtil.build({
      respond: (request) => {
        seen.push(request);
        return Promise.resolve(StubRuntimeUtil.buildResult("ok"));
      },
    }));
    const messages = [
      { role: "system", content: "SYSTEM-RULE" },
      { role: "user", content: "TURN-ONE" },
      { role: "assistant", content: "TURN-TWO" },
      { role: "user", content: "TURN-THREE" },
    ];
    await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody({ messages }) });
    const prompt = seen[0]?.prompt ?? "";
    const positions = ["SYSTEM-RULE", "TURN-ONE", "TURN-TWO", "TURN-THREE"].map((marker) => prompt.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((first, second) => first - second)).toStrictEqual(positions);
  });

  it("AC8: a client that disconnects while queued never starts its run", async () => {
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runtime = StubRuntimeUtil.build({
      respond: async () => {
        await blocker;
        return StubRuntimeUtil.buildResult("first");
      },
    });
    app = Fastify({ logger: false });
    ApiSetup.register(app, { runService: runtime.runService, clock: () => CLOCK_MS });
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const port = Number(new URL(address).port);
    const first = fetch(`${address}${CHAT_PATH}`, { method: "POST", headers: API_KEY_HEADER, body: buildChatBody() });
    await waitFor(() => runtime.requests.length === 1);
    const queued = sendRawChat(port);
    await waitFor(() => queued.written);
    queued.socket.destroy();
    await new Promise((resolve) => {
      setTimeout(resolve, DISCONNECT_SETTLE_MS);
    });
    release();
    await first;
    await new Promise((resolve) => {
      setTimeout(resolve, DISCONNECT_SETTLE_MS);
    });
    expect(runtime.requests).toHaveLength(1);
  });

  it("AC9: an unknown model returns 404 model_not_found", async () => {
    app = await buildApp(StubRuntimeUtil.build());
    const response = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ model: "gpt-4o" }),
    });
    expect(response.statusCode).toBe(404);
    expect(readErrorBody(response).error.code).toBe("model_not_found");
  });

  it("S3: the default effort is medium, and an unsupported effort returns 400", async () => {
    const runtime = StubRuntimeUtil.build();
    app = await buildApp(runtime);
    await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(runtime.requests[0]?.modelSlug).toBe("gemini-3.8-flash-medium");
    const invalid = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ reasoning_effort: "xhigh" }),
    });
    expect(invalid.statusCode).toBe(400);
    expect(readErrorBody(invalid).error.param).toBe("reasoning_effort");
  });

  it("S6: response_format other than text, image parts and streaming return 400 naming the parameter", async () => {
    app = await buildApp(StubRuntimeUtil.build());
    const format = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ response_format: { type: "json_object" } }),
    });
    expect(format.statusCode).toBe(400);
    expect(readErrorBody(format).error.param).toBe("response_format");
    const image = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] }],
      }),
    });
    expect(image.statusCode).toBe(400);
    expect(readErrorBody(image).error.param).toBe("messages");
    const stream = await app.inject({
      method: "POST",
      url: CHAT_PATH,
      headers: API_KEY_HEADER,
      payload: buildChatBody({ stream: true }),
    });
    expect(stream.statusCode).toBe(400);
  });

  it("S7: agy timeouts and failures map to 504 and 502 with the OpenAI error shape", async () => {
    app = await buildApp(StubRuntimeUtil.build({
      respond: () => Promise.reject(Object.assign(new Error("agy did not finish"), { code: "agy_timeout" })),
    }));
    const timeout = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(timeout.statusCode).toBe(504);
    expect(readErrorBody(timeout).error.code).toBe("agy_timeout");
    await app.close();
    app = await buildApp(StubRuntimeUtil.build({
      respond: () => Promise.reject(Object.assign(new Error("agy failed"), { code: "agy_failed" })),
    }));
    const failed = await app.inject({ method: "POST", url: CHAT_PATH, headers: API_KEY_HEADER, payload: buildChatBody() });
    expect(failed.statusCode).toBe(502);
    expect(readErrorBody(failed).error.type).toBe("server_error");
  });
});
