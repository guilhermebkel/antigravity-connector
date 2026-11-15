import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult, type StubRuntime } from "@antigravity-connector/core";
import { ApiSetup } from "@antigravity-connector/api/Setup/ApiSetup.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const PATH = "/v1/images/generations";
const IGNORED_HEADER = "x-antigravity-connector-ignored-params";
const CLOCK_MS = 1700000000000;
const JSON_HEADERS = { "content-type": "application/json" };

let app: FastifyInstance | undefined;

const buildPngResult = (): Promise<StubRunResult> => Promise.resolve({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles: { "output.png": PNG_BYTES },
});

type AppOptions = {
  respond?: () => Promise<StubRunResult>;
  limits?: { image: number };
};

type BuiltApp = {
  server: FastifyInstance;
  stub: StubRuntime;
};

const buildApp = (options: AppOptions = {}): BuiltApp => {
  const stub = StubRuntimeUtil.build({ respond: options.respond ?? buildPngResult, limits: options.limits });
  const server = Fastify({ logger: false });
  ApiSetup.register(server, { runService: stub.runService, loginService: stub.loginService, clock: () => CLOCK_MS });
  app = server;
  return { server, stub };
};

const post = (server: FastifyInstance, payload: Record<string, unknown>) => server.inject({
  method: "POST",
  url: PATH,
  headers: JSON_HEADERS,
  payload: JSON.stringify(payload),
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /v1/images/generations", () => {
  it("AC1: returns 200 with the PNG in data[0].b64_json", async () => {
    const { server } = buildApp();
    const response = await post(server, { prompt: "a red circle" });
    const body = JSON.parse(response.body) as { data: { b64_json: string }[] };

    expect(response.statusCode).toBe(200);
    expect(Buffer.from(body.data[0]?.b64_json ?? "", "base64").subarray(0, 4)).toStrictEqual(Buffer.from([137, 80, 78, 71]));
  });

  it("AC2: n of 2 returns 400 naming n", async () => {
    const { server, stub } = buildApp();
    const response = await post(server, { prompt: "x", n: 2 });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { param: "n" } });
    expect(stub.requests).toHaveLength(0);
  });

  it("AC3: the daily image limit returns 429 with daily_limit_reached", async () => {
    const { server } = buildApp({ limits: { image: 0 } });
    const response = await post(server, { prompt: "x" });

    expect(response.statusCode).toBe(429);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: "daily_limit_reached" } });
  });

  it("AC4: response_format url returns 400 and no run starts", async () => {
    const { server, stub } = buildApp();
    const response = await post(server, { prompt: "x", response_format: "url" });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { param: "response_format" } });
    expect(stub.requests).toHaveLength(0);
  });

  it("AC5: a run that writes no file returns 502 with agy_failed", async () => {
    const { server } = buildApp({ respond: () => Promise.resolve(StubRuntimeUtil.buildResult("no file")) });
    const response = await post(server, { prompt: "x" });

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: "agy_failed" } });
  });

  it("S2: size, quality and style are accepted, ignored and listed in a header", async () => {
    const { server } = buildApp();
    const response = await post(server, { prompt: "x", size: "1024x1024", quality: "hd" });

    expect(response.statusCode).toBe(200);
    expect(response.headers[IGNORED_HEADER]).toBe("size,quality");
  });
});
