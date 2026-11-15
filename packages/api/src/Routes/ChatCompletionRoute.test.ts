import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult, type StubRuntime } from "@antigravity-connector/core";
import { ApiSetup } from "@antigravity-connector/api/Setup/ApiSetup.ts";

const CHAT_PATH = "/v1/chat/completions";
const JSON_HEADERS = { "content-type": "application/json" };
const CLOCK_MS = 1700000000000;
const PNG_BASE64 = Buffer.from("89504e470d0a1a0a0000000d", "hex").toString("base64");

let app: FastifyInstance | undefined;

const buildApp = (respond?: () => Promise<StubRunResult>): {
  server: FastifyInstance; stub: StubRuntime;
} => {
  const stub = StubRuntimeUtil.build(respond === undefined ? {} : { respond });
  const server = Fastify({ logger: false });
  ApiSetup.register(server, {
    runService: stub.runService,
    loginService: stub.loginService,
    clock: () => CLOCK_MS,
    keepAliveMs: 60000,
  });
  app = server;
  return { server, stub };
};

const post = (server: FastifyInstance, payload: Record<string, unknown>) => server.inject({
  method: "POST",
  url: CHAT_PATH,
  headers: JSON_HEADERS,
  payload: JSON.stringify({ model: "gemini-3.8-flash", messages: [{ role: "user", content: "hi" }], ...payload }),
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /v1/chat/completions attachments and structured output", () => {
  it("AC1: a base64 PNG is sent to the run as an attachment", async () => {
    const { server, stub } = buildApp();
    const response = await post(server, {
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${PNG_BASE64}` } }] }],
    });

    expect(response.statusCode).toBe(200);
    expect(stub.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.png"]);
  });

  it("AC2: an https image URL returns 400 and no run starts", async () => {
    const { server, stub } = buildApp();
    const response = await post(server, {
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] }],
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { param: "messages" } });
    expect(stub.requests).toHaveLength(0);
  });

  it("AC3: a json_schema response returns the structured output as the content", async () => {
    const buildStructuredResult = (): Promise<StubRunResult> => {
      const base = StubRuntimeUtil.buildResult("");
      return Promise.resolve({ ...base, envelope: { ...base.envelope, structured_output: { answer: "ok" } } });
    };
    const { server, stub } = buildApp(buildStructuredResult);
    const response = await post(server, {
      response_format: { type: "json_schema", json_schema: { name: "x", schema: { type: "object" } } },
    });
    const body = JSON.parse(response.body) as { choices: { message: { content: string } }[] };

    expect(response.statusCode).toBe(200);
    expect(body.choices[0]?.message.content).toBe("{\"answer\":\"ok\"}");
    expect(stub.requests[0]?.jsonSchema).toBe("{\"type\":\"object\"}");
  });

  it("S5: a streamed json_schema response sends the JSON once, at the end", async () => {
    const buildStructuredResult = (): Promise<StubRunResult> => {
      const base = StubRuntimeUtil.buildResult("partial text that is not json");
      return Promise.resolve({ ...base, envelope: { ...base.envelope, structured_output: { answer: "ok" } } });
    };
    const { server } = buildApp(buildStructuredResult);
    const response = await post(server, {
      stream: true,
      response_format: { type: "json_schema", json_schema: { name: "x", schema: { type: "object" } } },
    });

    expect(response.body).toContain("{\\\"answer\\\":\\\"ok\\\"}");
    expect(response.body).not.toContain("partial");
  });
});

describe("POST /v1/chat/completions conversation_id", () => {
  it("AC2: an unknown conversation_id returns 400 and no run starts", async () => {
    const { server, stub } = buildApp();
    const response = await post(server, { conversation_id: "conv-unknown" });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { param: "conversation_id" } });
    expect(stub.requests).toHaveLength(0);
  });

  it("AC3: a flag-like conversation_id returns 400", async () => {
    const { server } = buildApp();
    const response = await post(server, { conversation_id: "--dangerously-skip-permissions" });

    expect(response.statusCode).toBe(400);
  });
});
