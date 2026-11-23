import { describe, expect, it } from "vitest";
import { AgyArgumentUtil } from "@antigravity-connector/agy/Utils/AgyArgumentUtil.ts";

const STREAM_FORMAT = "stream-json";
const OUTPUT_FORMAT_FLAG = "--output-format";
const JSON_FORMAT = "json";
const CHAT_PROFILE = { isPlanMode: true, shouldSkipPermissions: false, timeoutMs: 300000, expectedOutputFileNames: [] };

describe("AgyArgumentUtil.build", () => {
  it("builds a plan-mode chat run as one argument array", () => {
    const args = AgyArgumentUtil.build({ prompt: "User: hi", modelSlug: "gemini-3.8-flash-low", profile: CHAT_PROFILE });

    expect(args).toStrictEqual([
      "-p",
      "User: hi",
      OUTPUT_FORMAT_FLAG,
      JSON_FORMAT,
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
    }, JSON_FORMAT, "schema.json");

    expect(args).toStrictEqual([
      "-p",
      "User: draw",
      OUTPUT_FORMAT_FLAG,
      JSON_FORMAT,
      "--model",
      "gemini-4-argon-high",
      "--dangerously-skip-permissions",
      "--conversation",
      "00000000-0000-4000-8000-000000000000",
      "--json-schema",
      "schema.json",
    ]);
  });
});

describe("AgyArgumentUtil.buildPromptOnStdin", () => {
  it("builds a stream-json run that reads its prompt from stdin, so the prompt is not in the arguments", () => {
    const args = AgyArgumentUtil.buildPromptOnStdin({
      prompt: "User: private-marker-5521",
      modelSlug: "gemini-3.8-flash",
      profile: { ...CHAT_PROFILE, isPlanMode: false },
      conversationId: "conversation-9",
    });

    expect(args).toStrictEqual([
      "-p=",
      "--input-format",
      STREAM_FORMAT,
      OUTPUT_FORMAT_FLAG,
      STREAM_FORMAT,
      "--model",
      "gemini-3.8-flash",
      "--conversation",
      "conversation-9",
    ]);
    expect(args.join(" ")).not.toContain("private-marker-5521");
  });
});
