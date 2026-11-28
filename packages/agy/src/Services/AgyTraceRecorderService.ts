import type { AgyRunTrace } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export type AgyTraceSettleInput = {
  activeSubagentCount: number;
  candidateFileBytes: number;
  candidateFolder: string;
};

export class AgyTraceRecorderService {
  static readonly MAX_LABELS = 40;

  static readonly MAX_SUMMARY_LENGTH = 200;

  static readonly LABEL_SEPARATOR = ">";

  static readonly CUT_MARK = "...";

  private readonly clock: () => number;

  private readonly startedAtMs: number;

  private readonly labels: string[] = [];

  private readonly subagentIndexes = new Set<number>();

  private stepCount = 0;

  private afterResultExtensions = 0;

  private resultAfterMs: number | undefined = undefined;

  constructor(clock: () => number) {
    this.clock = clock;
    this.startedAtMs = clock();
  }

  recordStep(label: string | undefined): void {
    if (label === undefined) {
      return;
    }
    this.stepCount += 1;
    const isRepeat = this.labels.at(-1) === label;
    if (!isRepeat && this.labels.length < AgyTraceRecorderService.MAX_LABELS) {
      // Why: the trace keeps only step kinds, tool names and states, never the text of an answer or a prompt.
      this.labels.push(label);
    }
  }

  recordSubagent(index: number): void {
    this.subagentIndexes.add(index);
  }

  recordResult(): void {
    this.resultAfterMs ??= this.readElapsedMs();
  }

  recordAfterResultExtension(): void {
    this.afterResultExtensions += 1;
  }

  build(input: AgyTraceSettleInput): AgyRunTrace {
    return {
      stepCount: this.stepCount,
      stepSummary: this.buildSummary(),
      subagentCount: this.subagentIndexes.size,
      activeSubagentCount: input.activeSubagentCount,
      afterResultExtensions: this.afterResultExtensions,
      ...(this.resultAfterMs === undefined ? {} : { resultAfterMs: this.resultAfterMs }),
      settledAfterMs: this.readElapsedMs(),
      candidateFileBytes: input.candidateFileBytes,
      candidateFolder: input.candidateFolder,
    };
  }

  private buildSummary(): string {
    const joined = this.labels.join(AgyTraceRecorderService.LABEL_SEPARATOR);
    if (joined.length <= AgyTraceRecorderService.MAX_SUMMARY_LENGTH) {
      return joined;
    }
    const keep = AgyTraceRecorderService.MAX_SUMMARY_LENGTH - AgyTraceRecorderService.CUT_MARK.length;
    return `${joined.slice(0, keep)}${AgyTraceRecorderService.CUT_MARK}`;
  }

  private readElapsedMs(): number {
    return this.clock() - this.startedAtMs;
  }
}
