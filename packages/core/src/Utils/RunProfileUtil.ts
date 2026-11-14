import type { ReasoningEffort, RunKind } from "@antigravity-connector/protocol";
import type { AgyRunProfile } from "@antigravity-connector/agy";

type RunKindSpec = {
  isPlanMode: boolean;
  shouldSkipPermissions: boolean;
  timeoutMultiplier: number;
  expectedOutputFileNames: readonly string[];
};

export class RunProfileUtil {
  static readonly DEFAULT_EFFORT: ReasoningEffort = "low";

  static readonly RESEARCH_TIMEOUT_MULTIPLIER = 2;

  static readonly RUN_KIND_TO_SPEC: Readonly<Record<RunKind, RunKindSpec>> = {
    chat: { isPlanMode: true, shouldSkipPermissions: false, timeoutMultiplier: 1, expectedOutputFileNames: [] },
    search: { isPlanMode: true, shouldSkipPermissions: false, timeoutMultiplier: 1, expectedOutputFileNames: [] },
    research: {
      isPlanMode: true,
      shouldSkipPermissions: false,
      timeoutMultiplier: RunProfileUtil.RESEARCH_TIMEOUT_MULTIPLIER,
      expectedOutputFileNames: [],
    },
    image: { isPlanMode: false, shouldSkipPermissions: false, timeoutMultiplier: 1, expectedOutputFileNames: ["output.png"] },
    browse: {
      isPlanMode: false,
      shouldSkipPermissions: false,
      timeoutMultiplier: 1,
      expectedOutputFileNames: ["screenshot.png"],
    },
  };

  static build(kind: RunKind, baseTimeoutMs: number): AgyRunProfile {
    const spec = RunProfileUtil.RUN_KIND_TO_SPEC[kind];
    return {
      isPlanMode: spec.isPlanMode,
      shouldSkipPermissions: spec.shouldSkipPermissions,
      timeoutMs: baseTimeoutMs * spec.timeoutMultiplier,
      expectedOutputFileNames: spec.expectedOutputFileNames,
    };
  }
}
