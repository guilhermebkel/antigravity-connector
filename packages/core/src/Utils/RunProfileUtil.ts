import type { ReasoningEffort, RunKind } from "@antigravity-connector/protocol";
import type { AgyRunProfile } from "@antigravity-connector/agy";

type RunKindSpec = {
  isPlanMode: boolean;
  shouldSkipPermissions: boolean;
  timeoutMultiplier: number;
  expectedOutputFileNames: readonly string[];
  shouldWaitForOutputFiles: boolean;
};

export class RunProfileUtil {
  static readonly DEFAULT_EFFORT: ReasoningEffort = "low";

  static readonly RESEARCH_TIMEOUT_MULTIPLIER = 2;

  static readonly RUN_KIND_TO_SPEC: Readonly<Record<RunKind, RunKindSpec>> = {
    chat: {
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMultiplier: 1,
      expectedOutputFileNames: [],
      shouldWaitForOutputFiles: false,
    },
    search: {
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMultiplier: 1,
      expectedOutputFileNames: [],
      shouldWaitForOutputFiles: false,
    },
    research: {
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMultiplier: RunProfileUtil.RESEARCH_TIMEOUT_MULTIPLIER,
      expectedOutputFileNames: [],
      shouldWaitForOutputFiles: false,
    },
    image: {
      isPlanMode: false,
      shouldSkipPermissions: false,
      timeoutMultiplier: 1,
      expectedOutputFileNames: ["output.png"],
      shouldWaitForOutputFiles: true,
    },
    browse: {
      isPlanMode: false,
      shouldSkipPermissions: false,
      timeoutMultiplier: 1,
      expectedOutputFileNames: ["screenshot.png"],
      shouldWaitForOutputFiles: false,
    },
  };

  static build(kind: RunKind, baseTimeoutMs: number): AgyRunProfile {
    const spec = RunProfileUtil.RUN_KIND_TO_SPEC[kind];
    return {
      isPlanMode: spec.isPlanMode,
      shouldSkipPermissions: spec.shouldSkipPermissions,
      timeoutMs: baseTimeoutMs * spec.timeoutMultiplier,
      expectedOutputFileNames: spec.expectedOutputFileNames,
      shouldWaitForOutputFiles: spec.shouldWaitForOutputFiles,
    };
  }
}
