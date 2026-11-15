import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { StubLoginPort, StubRuntimeUtil, type StubRuntime } from "@antigravity-connector/core";
import { ApiSetup } from "@antigravity-connector/api/Setup/ApiSetup.ts";

const AUTH_PATH = "/v1/auth";
const JSON_HEADERS = { "content-type": "application/json" };
const CLOCK_MS = 1700000000000;

let app: FastifyInstance | undefined;

type BuiltApp = {
  server: FastifyInstance;
  stub: StubRuntime;
};

const buildApp = (sessionKind: "connected" | "login_required"): BuiltApp => {
  const stub = StubRuntimeUtil.build({ sessionKind });
  const server = Fastify({ logger: false });
  ApiSetup.register(server, { runService: stub.runService, loginService: stub.loginService, clock: () => CLOCK_MS });
  app = server;
  return { server, stub };
};

const postCode = (server: FastifyInstance, payload: string) => server.inject({
  method: "POST",
  url: AUTH_PATH,
  headers: JSON_HEADERS,
  payload,
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET and POST /v1/auth", () => {
  it("GET returns connected when agy is logged in", async () => {
    const { server } = buildApp("connected");
    const response = await server.inject({ method: "GET", url: AUTH_PATH });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toStrictEqual({ status: "connected" });
  });

  it("GET returns the login link and its lifetime when login is required", async () => {
    const { server } = buildApp("login_required");
    const response = await server.inject({ method: "GET", url: AUTH_PATH });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toStrictEqual({
      status: "login_required",
      login_url: StubLoginPort.LOGIN_URL,
      expires_in_seconds: 60,
    });
  });

  it("POST with a wrong code returns 400 naming code, and the next GET gives a new link", async () => {
    const { server } = buildApp("login_required");
    await server.inject({ method: "GET", url: AUTH_PATH });
    const refused = await postCode(server, JSON.stringify({ code: "wrong" }));
    const again = await server.inject({ method: "GET", url: AUTH_PATH });

    expect(refused.statusCode).toBe(400);
    expect(JSON.parse(refused.body)).toMatchObject({ error: { param: "code" } });
    expect(JSON.parse(again.body)).toMatchObject({ status: "login_required" });
  });

  it("POST with the right code connects and returns connected", async () => {
    const { server } = buildApp("login_required");
    await server.inject({ method: "GET", url: AUTH_PATH });
    const connected = await postCode(server, JSON.stringify({ code: StubLoginPort.GOOD_CODE }));

    expect(connected.statusCode).toBe(200);
    expect(JSON.parse(connected.body)).toMatchObject({ status: "connected" });
  });

  it("POST without a code returns 400 and does not touch the login", async () => {
    const { server } = buildApp("login_required");
    const response = await postCode(server, JSON.stringify({ token: "not a code" }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { param: "code" } });
  });

  it("POST before any login link returns 400 telling the client to call GET first", async () => {
    const { server } = buildApp("login_required");
    const response = await postCode(server, JSON.stringify({ code: "anything" }));

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as { error: { message: string } };
    expect(body.error.message).toContain("Call check auth first");
  });
});
