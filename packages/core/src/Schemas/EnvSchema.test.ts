import { describe, expect, it } from "vitest";
import { EnvSchema } from "@antigravity-connector/core/Schemas/EnvSchema.ts";

const FAKE_API_KEY = "test-api-key-0123456789abcdef";

describe("EnvSchema", () => {
  it("fills the defaults from the variable table when only API_KEY is set", () => {
    const env = EnvSchema.parse({ API_KEY: FAKE_API_KEY });

    expect(env).toStrictEqual({
      API_KEY: FAKE_API_KEY,
      HOST: "127.0.0.1",
      PORT: 8787,
      ALLOW_NON_LOOPBACK_BIND: false,
      AGY_BIN: "agy",
      AGY_TIMEOUT_MS: 300000,
      QUEUE_MAX_WAIT_MS: 120000,
      QUEUE_CONCURRENCY: 4,
      DAILY_LIMIT_CHAT: 200,
      DAILY_LIMIT_SEARCH: 50,
      DAILY_LIMIT_IMAGE: 20,
      DAILY_LIMIT_RESEARCH: 5,
      DAILY_LIMIT_BROWSE: 20,
      HTTP_MAX_REQUESTS_PER_MINUTE: 120,
      MCP_MAX_SESSIONS: 8,
      MCP_SESSION_TTL_MS: 1800000,
      DATA_DIR: "data",
      LOG_LEVEL: "info",
    });
  });

  it("reads PUBLIC_URL as an origin and leaves it out when it is empty or missing", () => {
    const set = EnvSchema.parse({ API_KEY: FAKE_API_KEY, PUBLIC_URL: "https://connector.example.com" });
    const empty = EnvSchema.parse({ API_KEY: FAKE_API_KEY, PUBLIC_URL: "" });
    expect(set.PUBLIC_URL).toBe("https://connector.example.com");
    expect(empty.PUBLIC_URL).toBeUndefined();
  });

  it.each([
    ["connector.example.com"],
    ["ftp://connector.example.com"],
    ["https://connector.example.com/app"],
  ])("refuses PUBLIC_URL %s: it must be an http or https origin", (value) => {
    const result = EnvSchema.safeParse({ API_KEY: FAKE_API_KEY, PUBLIC_URL: value });
    const names = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect([...names]).toStrictEqual(["PUBLIC_URL"]);
  });

  it("reads numbers and the boolean from their text form", () => {
    const env = EnvSchema.parse({ API_KEY: FAKE_API_KEY, PORT: "9000", ALLOW_NON_LOOPBACK_BIND: "true" });

    expect(env.PORT).toBe(9000);
    expect(env.ALLOW_NON_LOOPBACK_BIND).toBe(true);
  });

  it("refuses an API key shorter than 24 characters", () => {
    const result = EnvSchema.safeParse({ API_KEY: "short-key" });

    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["API_KEY"]]);
  });
});
