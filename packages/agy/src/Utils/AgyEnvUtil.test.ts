import { describe, expect, it } from "vitest";
import { AgyEnvUtil } from "@antigravity-connector/agy/Utils/AgyEnvUtil.ts";

describe("AgyEnvUtil.build", () => {
  it("passes only the allow-listed variables and never the API key", () => {
    const parentEnv = {
      HOME: "/home/agy",
      PATH: "/usr/bin",
      API_KEY: "test-api-key-0123456789abcdef",
      SECRET_OTHER: "value",
    };

    const childEnv = AgyEnvUtil.build(parentEnv);

    expect(childEnv).toStrictEqual({ HOME: "/home/agy", PATH: "/usr/bin" });
  });
});
