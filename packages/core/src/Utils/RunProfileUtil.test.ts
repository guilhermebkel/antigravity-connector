import { describe, expect, it } from "vitest";
import { RunProfileUtil } from "@antigravity-connector/core/Utils/RunProfileUtil.ts";

const BASE_TIMEOUT_MS = 300000;

describe("RunProfileUtil.build", () => {
  it("builds a plan-mode profile with the base timeout for chat", () => {
    expect(RunProfileUtil.build("chat", BASE_TIMEOUT_MS)).toStrictEqual({
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMs: 300000,
      expectedOutputFileNames: [],
      shouldWaitForOutputFiles: false,
    });
  });

  it("gives an image call 60 percent of the base timeout, rounded to a whole millisecond", () => {
    expect(RunProfileUtil.build("image", BASE_TIMEOUT_MS).timeoutMs).toBe(180000);
    expect(RunProfileUtil.build("image", 1001).timeoutMs).toBe(601);
  });

  it("doubles the timeout for research", () => {
    expect(RunProfileUtil.build("research", BASE_TIMEOUT_MS).timeoutMs).toBe(600000);
  });

  it("does not use plan mode for image and expects the output file", () => {
    expect(RunProfileUtil.build("image", BASE_TIMEOUT_MS)).toStrictEqual({
      isPlanMode: false,
      shouldSkipPermissions: false,
      timeoutMs: 180000,
      expectedOutputFileNames: ["output.png"],
      shouldWaitForOutputFiles: true,
    });
  });

  it("AC7: only image and browse run without plan mode, and image expects output.png", () => {
    const nonPlanKinds = (["chat", "search", "research", "image", "browse", "media"] as const).filter(
      (kind) => !RunProfileUtil.build(kind, 1000).isPlanMode,
    );
    expect(nonPlanKinds).toStrictEqual(["image", "browse"]);
    expect(RunProfileUtil.build("image", 1000).expectedOutputFileNames).toStrictEqual(["output.png"]);
  });

  it("only image waits for its output file; browse keeps its screenshot optional", () => {
    const waitingKinds = (["chat", "search", "research", "image", "browse", "media"] as const).filter(
      (kind) => RunProfileUtil.build(kind, 1000).shouldWaitForOutputFiles,
    );
    expect(waitingKinds).toStrictEqual(["image"]);
  });

  it("a media run is a plan-mode run with no output file and the base timeout", () => {
    expect(RunProfileUtil.build("media", 300000)).toStrictEqual({
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMs: 300000,
      expectedOutputFileNames: [],
      shouldWaitForOutputFiles: false,
    });
  });

  it("each run kind has its own default effort: research is medium, the others low", () => {
    const efforts = Object.fromEntries(
      (["chat", "search", "research", "image", "browse", "media"] as const).map((kind) => [kind, RunProfileUtil.RUN_KIND_TO_SPEC[kind].effort]),
    );
    expect(efforts).toStrictEqual({ chat: "low", search: "low", research: "medium", image: "low", browse: "low", media: "low" });
  });
});
