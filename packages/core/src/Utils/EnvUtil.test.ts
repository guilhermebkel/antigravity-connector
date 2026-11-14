import { describe, expect, it } from "vitest";
import { EnvUtil } from "@antigravity-connector/core/Utils/EnvUtil.ts";
import type { EnvNameToValue } from "@antigravity-connector/core/Protocols/EnvProtocol.ts";

const FAKE_API_KEY = "test-api-key-0123456789abcdef";
const SHORT_KEY = "short-key";
const INVALID_MESSAGE = "Invalid environment variables: API_KEY. Values are not shown.";

const loadEnv = (source: EnvNameToValue): unknown => EnvUtil.load(source);

describe("EnvUtil.load", () => {
  it("names API_KEY when it is missing and does not print any value", () => {
    expect(() => loadEnv({ PORT: "8787" })).toThrow(INVALID_MESSAGE);
  });

  it("names API_KEY when it is too short and does not print the value", () => {
    expect(() => loadEnv({ API_KEY: SHORT_KEY })).toThrow(INVALID_MESSAGE);
    expect(() => loadEnv({ API_KEY: SHORT_KEY })).not.toThrow(SHORT_KEY);
  });

  it("loads a valid environment with the defaults", () => {
    const env = EnvUtil.load({ API_KEY: FAKE_API_KEY });

    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe(8787);
  });
});
