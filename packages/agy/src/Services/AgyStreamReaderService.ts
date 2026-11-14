import { AsyncEventBufferService, RedactUtil, type AgyStatus } from "@antigravity-connector/protocol";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import type { AgyStreamOutputEvent } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyOutcomeUtil } from "@antigravity-connector/agy/Utils/AgyOutcomeUtil.ts";
import { AgyStreamEventUtil } from "@antigravity-connector/agy/Utils/AgyStreamEventUtil.ts";

export type AgyStreamReaderOptions = {
  timeoutMs: number;
  secrets: readonly string[];
};

const LINE_SEPARATOR = "\n";

export class AgyStreamReaderService {
  private readonly buffer: AsyncEventBufferService<AgyStreamOutputEvent>;

  private readonly timeoutMs: number;

  private readonly secrets: readonly string[];

  private pendingLine = "";

  private stdoutText = "";

  private stderrText = "";

  private hasResult = false;

  private resultStatus: AgyStatus | undefined = undefined;

  constructor(buffer: AsyncEventBufferService<AgyStreamOutputEvent>, options: AgyStreamReaderOptions) {
    this.buffer = buffer;
    this.timeoutMs = options.timeoutMs;
    this.secrets = options.secrets;
  }

  addStdout(chunk: string): void {
    this.stdoutText += chunk;
    const lines = (this.pendingLine + chunk).split(LINE_SEPARATOR);
    this.pendingLine = lines.pop() ?? "";
    for (const line of lines) {
      this.handleLine(line);
    }
  }

  addStderr(chunk: string): void {
    this.stderrText += chunk;
  }

  finish(exitCode: number | null, isTimedOut: boolean): void {
    if (this.pendingLine !== "") {
      this.handleLine(this.pendingLine);
      this.pendingLine = "";
    }
    this.buffer.end(this.findFailure(exitCode, isTimedOut));
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed === "") {
      return;
    }
    const event = AgyStreamEventUtil.parseLine(trimmed);
    if (event === undefined) {
      return;
    }
    if (AgyStreamEventUtil.isResult(event)) {
      this.hasResult = true;
      this.resultStatus = event.result.status;
    }
    for (const output of AgyStreamEventUtil.buildOutputEvents(event)) {
      this.buffer.push(output);
    }
  }

  private findFailure(exitCode: number | null, isTimedOut: boolean): Error | undefined {
    const processFailure = AgyOutcomeUtil.findProcessFailure(
      { stdout: this.stdoutText, stderr: this.stderrText, exitCode, isTimedOut },
      this.timeoutMs,
      this.secrets,
    );
    if (processFailure !== undefined) {
      return processFailure;
    }
    if (!this.hasResult) {
      return new AgyOutputError("the stream ended without a result event");
    }
    if (this.resultStatus !== "SUCCESS") {
      return new AgyFailedError(exitCode, RedactUtil.buildExcerpt(this.stderrText, this.secrets));
    }
    return undefined;
  }
}
