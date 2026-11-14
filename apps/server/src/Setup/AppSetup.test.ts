import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgySessionKind } from "@antigravity-connector/core";
import { AppSetup } from "@antigravity-connector/server/Setup/AppSetup.ts";

const API_KEY = "test-api-key-0123456789abcdef";
const BEARER = `Bearer ${API_KEY}`;
const PROBE_PATH = "/v1/probe";
const LIMIT_PER_MINUTE = 3;

describe("AppSetup", () => {
  let app: FastifyInstance;
  let probeCalls: number;
  let sessionKind: AgySessionKind;

  beforeEach(async () => {
    probeCalls = 0;
    sessionKind = "connected";
    app = await AppSetup.build({
      apiKey: API_KEY,
      maxRequestsPerMinute: LIMIT_PER_MINUTE,
      clock: () => 0,
      readSessionKind: () => sessionKind,
      routePlugins: [
        (instance) => {
          instance.post(PROBE_PATH, () => {
            probeCalls += 1;
            return { ok: true };
          });
        },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("AC1: GET /health needs no header and answers only status and agy", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ status: "ok", agy: "connected" });
  });

  it("AC2: a route without a bearer or with a wrong one returns 401 and the handler does not run", async () => {
    const missing = await app.inject({ method: "POST", url: PROBE_PATH, payload: {} });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toStrictEqual({
      error: {
        message: "Incorrect API key provided.",
        type: "authentication_error",
        param: null,
        code: "invalid_api_key",
      },
    });
    const wrong = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { authorization: `Bearer ${API_KEY.slice(1)}` },
      payload: {},
    });
    expect(wrong.statusCode).toBe(401);
    expect(probeCalls).toBe(0);
  });

  it("AC2: a route outside /v1 answers with the plain Unauthorized text", async () => {
    const response = await app.inject({ method: "POST", url: "/other", payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.body).toBe("Unauthorized");
  });

  it("AC3: the right bearer reaches the handler", async () => {
    const response = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { authorization: BEARER },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(probeCalls).toBe(1);
  });

  it("AC4: failed authentications over the limit get 429, and the valid bearer still succeeds", async () => {
    for (let attempt = 0; attempt < LIMIT_PER_MINUTE; attempt += 1) {
      const failed = await app.inject({ method: "POST", url: PROBE_PATH, payload: {} });
      expect(failed.statusCode).toBe(401);
    }
    const limited = await app.inject({ method: "POST", url: PROBE_PATH, payload: {} });
    expect(limited.statusCode).toBe(429);
    const valid = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { authorization: BEARER },
      payload: {},
    });
    expect(valid.statusCode).toBe(200);
  });

  it("AC6: the health body shows login_required and never the login URL", async () => {
    sessionKind = "login_required";
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toStrictEqual({ status: "ok", agy: "login_required" });
    expect(response.body).not.toContain("accounts.google.com");
  });

  it("AC7: a body over the limit returns 413 and invalid JSON returns 400, and no handler runs", async () => {
    const tooLarge = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { "authorization": BEARER, "content-type": "application/json" },
      payload: JSON.stringify({ text: "x".repeat(AppSetup.MAX_BODY_BYTES) }),
    });
    expect(tooLarge.statusCode).toBe(413);
    const invalid = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { "authorization": BEARER, "content-type": "application/json" },
      payload: "{not json",
    });
    expect(invalid.statusCode).toBe(400);
    expect(probeCalls).toBe(0);
  });

  it("never echoes the API key in a response", async () => {
    const response = await app.inject({
      method: "POST",
      url: PROBE_PATH,
      headers: { authorization: `Bearer ${API_KEY}x` },
      payload: {},
    });
    expect(response.body).not.toContain(API_KEY);
  });
});
