import { describe, expect, it } from "vitest";
import { AgyTraceRecorderService } from "@antigravity-connector/agy/Services/AgyTraceRecorderService.ts";

const buildRecorder = (times: number[]): AgyTraceRecorderService => {
  const queue = [...times];
  return new AgyTraceRecorderService(() => queue.shift() ?? 0);
};

describe("AgyTraceRecorderService", () => {
  it("keeps the step labels in order, without a repeat in a row, and counts every step", () => {
    const recorder = buildRecorder([0, 10]);
    recorder.recordStep("subagent ACTIVE");
    recorder.recordStep("subagent ACTIVE");
    recorder.recordStep("tool:read_file DONE");

    const trace = recorder.build({ activeSubagentCount: 1, candidateFileBytes: 0, candidateFolder: "run" });

    expect(trace).toStrictEqual({
      stepCount: 3,
      stepSummary: "subagent ACTIVE>tool:read_file DONE",
      subagentCount: 0,
      activeSubagentCount: 1,
      afterResultExtensions: 0,
      settledAfterMs: 10,
      candidateFileBytes: 0,
      candidateFolder: "run",
    });
  });

  it("cuts a long summary and marks the cut, and stops listing after the label limit", () => {
    const recorder = buildRecorder([0, 1]);
    for (let index = 0; index < 60; index += 1) {
      recorder.recordStep(`tool:step_${index}`);
    }

    const trace = recorder.build({ activeSubagentCount: 0, candidateFileBytes: 0, candidateFolder: "run" });

    expect(trace.stepCount).toBe(60);
    expect(trace.stepSummary).toHaveLength(AgyTraceRecorderService.MAX_SUMMARY_LENGTH);
    expect(trace.stepSummary.endsWith("...")).toBe(true);
  });

  it("gives the time of the result once, and counts the subagents by their index", () => {
    const recorder = buildRecorder([0, 40, 90, 120, 130]);
    recorder.recordSubagent(1);
    recorder.recordSubagent(1);
    recorder.recordSubagent(2);
    recorder.recordResult();
    recorder.recordResult();
    recorder.recordAfterResultExtension();

    const trace = recorder.build({ activeSubagentCount: 0, candidateFileBytes: 512, candidateFolder: "run" });

    expect(trace).toMatchObject({
      subagentCount: 2,
      afterResultExtensions: 1,
      resultAfterMs: 40,
      candidateFileBytes: 512,
    });
  });

  it("leaves the result time out when no result came", () => {
    const recorder = buildRecorder([0, 5]);

    const trace = recorder.build({ activeSubagentCount: 0, candidateFileBytes: 0, candidateFolder: "run" });

    expect(trace).not.toHaveProperty("resultAfterMs");
  });
});
