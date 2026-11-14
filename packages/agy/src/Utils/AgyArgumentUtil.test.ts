import { describe, expect, it } from "vitest";
import { AgyArgumentUtil } from "@antigravity-connector/agy/Utils/AgyArgumentUtil.ts";

const CHAT_PROFILE = { isPlanMode: true, shouldSkipPermissions: false, timeoutMs: 300000, expectedOutputFileNames: [] };

describe("AgyArgumentUtil.build", () => {
  it("builds a plan-mode chat run as one argument array", () => {
    const args = AgyArgumentUtil.build({ prompt: "User: hi", modelSlug: "gemini-3.8-flash-low", profile: CHAT_PROFILE });

    expect(args).toStrictEqual([
      "-p",
      "User: hi",
      "--output-format",
      "json",
      "--model",
      "gemini-3.8-flash-low",
      "--mode",
      "plan",
    ]);
  });

  it("adds the permission flag, the conversation and the schema when the profile asks for them", () => {
    const args = AgyArgumentUtil.build({
      prompt: "User: draw",
      modelSlug: "gemini-4-argon-high",
      profile: { ...CHAT_PROFILE, isPlanMode: false, shouldSkipPermissions: true },
      conversationId: "00000000-0000-4000-8000-000000000000",
      jsonSchema: "{\"type\":\"object\"}",
    });

    expect(args).toStrictEqual([
      "-p",
      "User: draw",
      "--output-format",
      "json",
      "--model",
      "gemini-4-argon-high",
      "--dangerously-skip-permissions",
      "--conversation",
      "00000000-0000-4000-8000-000000000000",
      "--json-schema",
      "{\"type\":\"object\"}",
    ]);
  });
});
