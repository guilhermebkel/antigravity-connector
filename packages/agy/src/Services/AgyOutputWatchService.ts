import type { ChildProcess } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { RedactUtil } from "@antigravity-connector/protocol";
import type { AgyEnvelope, AgyStatus, AgyUsage } from "@antigravity-connector/protocol";
import { AgyAbortedError } from "@antigravity-connector/agy/Errors/AgyAbortedError.ts";
import { AgyTimeoutError } from "@antigravity-connector/agy/Errors/AgyTimeoutError.ts";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import type {
  AgyLastActivity,
  AgyOutputFileNameToBytes,
  AgyOutputWatchTiming,
  AgyRunResult,
} from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyOutcomeUtil } from "@antigravity-connector/agy/Utils/AgyOutcomeUtil.ts";
import { AgyOutputFileUtil } from "@antigravity-connector/agy/Utils/AgyOutputFileUtil.ts";
import { AgyStdinMessageUtil } from "@antigravity-connector/agy/Utils/AgyStdinMessageUtil.ts";
import { AgyStreamEventUtil } from "@antigravity-connector/agy/Utils/AgyStreamEventUtil.ts";
import { AgyTraceRecorderService } from "@antigravity-connector/agy/Services/AgyTraceRecorderService.ts";

type AgyCandidateFolder = "run" | "brain" | "none";

type OutputTarget = {
  name: string;
  path: string;
  folder: AgyCandidateFolder;
};

export type AgyOutputWatchOptions = {
  child: ChildProcess;
  prompt: string;
  workingDirectory: string;
  fileNames: readonly string[];
  excludedFileNames?: readonly string[];
  brainRoot?: string;
  timeoutMs: number;
  secrets: readonly string[];
  signal: AbortSignal | undefined;
  timing: AgyOutputWatchTiming;
  stopProcess: () => void;
};

export class AgyOutputWatchService {
  static readonly LINE_SEPARATOR = "\n";

  static readonly SUCCESS_STATUS: AgyStatus = "SUCCESS";

  static readonly EMPTY_USAGE: AgyUsage = {
    input_tokens: 0,
    output_tokens: 0,
    thinking_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
  };

  private readonly options: AgyOutputWatchOptions;

  private readonly fileNameToLastSize = new Map<string, number>();

  private stdoutText = "";

  private stderrText = "";

  private pendingLine = "";

  private conversationId = "";

  private candidateFolder: AgyCandidateFolder = "none";

  private result: AgyEnvelope | undefined = undefined;

  private lastStep: string | undefined = undefined;

  private lastEventAtMs = 0;

  private hasSentPrompt = false;

  private isFilesReady = false;

  private isPolling = false;

  private isTimedOut = false;

  private isSettled = false;

  private pollTimer: NodeJS.Timeout | undefined = undefined;

  private timeoutTimer: NodeJS.Timeout | undefined = undefined;

  private graceTimer: NodeJS.Timeout | undefined = undefined;

  private afterResultTimer: NodeJS.Timeout | undefined = undefined;

  private readonly activeSubagentIndexes = new Set<number>();

  private readonly trace: AgyTraceRecorderService;

  private resolveRun: (result: AgyRunResult) => void = () => undefined;

  private rejectRun: (error: Error) => void = () => undefined;

  constructor(options: AgyOutputWatchOptions) {
    this.options = options;
    this.trace = new AgyTraceRecorderService(() => Date.now());
  }

  watch(): Promise<AgyRunResult> {
    return new Promise<AgyRunResult>((resolve, reject) => {
      this.resolveRun = resolve;
      this.rejectRun = reject;
      this.attachListeners();
    });
  }

  private attachListeners(): void {
    const { child, signal, timing, timeoutMs } = this.options;
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      this.addStdout(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      this.stderrText += chunk;
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error: Error) => {
      this.fail(error);
    });
    child.on("close", (exitCode: number | null) => {
      void this.handleClose(exitCode);
    });
    this.pollTimer = setInterval(() => {
      void this.pollFiles();
    }, timing.pollMs);
    this.timeoutTimer = setTimeout(() => {
      this.isTimedOut = true;
      this.options.stopProcess();
    }, timeoutMs);
    signal?.addEventListener("abort", () => {
      this.options.stopProcess();
      this.fail(new AgyAbortedError());
    }, { once: true });
  }

  private addStdout(chunk: string): void {
    this.stdoutText += chunk;
    const lines = (this.pendingLine + chunk).split(AgyOutputWatchService.LINE_SEPARATOR);
    this.pendingLine = lines.pop() ?? "";
    for (const line of lines) {
      this.handleLine(line.trim());
    }
  }

  private handleLine(line: string): void {
    if (line === "") {
      return;
    }
    this.recordActivity(line);
    const event = AgyStreamEventUtil.parseLine(line);
    if (event === undefined) {
      return;
    }
    if (AgyStreamEventUtil.isInit(event)) {
      this.conversationId = event.conversation_id;
      this.sendPrompt();
    }
    if (AgyStreamEventUtil.isResult(event)) {
      void this.handleResult(event.result);
    }
  }

  private recordActivity(line: string): void {
    this.lastEventAtMs = Date.now();
    const label = AgyStreamEventUtil.readStepLabel(line);
    this.lastStep = label ?? this.lastStep;
    this.trace.recordStep(label);
    this.trackSubagent(line);
  }

  private trackSubagent(line: string): void {
    const subagent = AgyStreamEventUtil.readSubagentStep(line);
    if (subagent === undefined) {
      return;
    }
    this.trace.recordSubagent(subagent.index);
    if (subagent.isActive) {
      this.activeSubagentIndexes.add(subagent.index);
    } else {
      this.activeSubagentIndexes.delete(subagent.index);
    }
  }

  private buildLastActivity(): AgyLastActivity | undefined {
    if (this.lastEventAtMs === 0) {
      return undefined;
    }
    return { step: this.lastStep ?? "none", idleMs: Date.now() - this.lastEventAtMs };
  }

  private sendPrompt(): void {
    if (this.hasSentPrompt) {
      return;
    }
    this.hasSentPrompt = true;
    this.options.child.stdin?.write(AgyStdinMessageUtil.buildUserLine(this.options.prompt));
  }

  private async handleResult(envelope: AgyEnvelope): Promise<void> {
    this.result = envelope;
    this.trace.recordResult();
    if (envelope.status !== AgyOutputWatchService.SUCCESS_STATUS) {
      const excerpt = RedactUtil.buildExcerpt(this.stderrText, this.options.secrets);
      const { secrets } = this.options;
      const error = envelope.error === undefined ? undefined : RedactUtil.buildExcerpt(envelope.error, secrets);
      this.fail(new AgyFailedError(null, excerpt, { status: envelope.status, error }));
      return;
    }
    await this.pollFiles();
    if (this.isFilesReady) {
      await this.settleWithResult();
      return;
    }
    this.scheduleAfterResultCheck();
  }

  private scheduleAfterResultCheck(): void {
    this.afterResultTimer ??= setTimeout(() => {
      this.afterResultTimer = undefined;
      void this.onAfterResultWaitEnded();
    }, this.options.timing.afterResultWaitMs);
  }

  private async onAfterResultWaitEnded(): Promise<void> {
    if (this.isSettled) {
      return;
    }
    // Why: the wait after the result is for a subagent that is still working; while one is active the run keeps waiting, and the overall timeout still stops it.
    if (this.activeSubagentIndexes.size > 0) {
      this.trace.recordAfterResultExtension();
      this.scheduleAfterResultCheck();
      return;
    }
    await this.settleWithResult();
  }

  private async pollFiles(): Promise<void> {
    if (this.isPolling || this.isSettled) {
      return;
    }
    this.isPolling = true;
    try {
      const target = await this.findTarget();
      this.candidateFolder = target?.folder ?? "none";
      this.isFilesReady = target === undefined ? false : await this.checkFile(target);
    } finally {
      this.isPolling = false;
    }
    if (this.isFilesReady && !this.hasSettled()) {
      await this.handleFilesReady();
    }
  }

  private async findTarget(): Promise<OutputTarget | undefined> {
    const local = await this.findTargetIn(this.options.workingDirectory, "run");
    if (local !== undefined) {
      return local;
    }
    const brainDirectory = this.buildBrainDirectory();
    return brainDirectory === undefined ? undefined : this.findTargetIn(brainDirectory, "brain");
  }

  private async findTargetIn(directory: string, folder: AgyCandidateFolder): Promise<OutputTarget | undefined> {
    const [expectedName = ""] = this.options.fileNames;
    // Why: the folder is listed on every poll, so a picture saved under another name is found the same way as output.png.
    const names = await readdir(directory).catch((): string[] => []);
    const name = AgyOutputFileUtil.pickTarget(names, expectedName, this.options.excludedFileNames ?? []);
    return name === undefined ? undefined : { folder, name, path: join(directory, name) };
  }

  private buildBrainDirectory(): string | undefined {
    // Why: agy keeps a picture its subagent made in the folder of its conversation; the picture is read from there when agy did not copy it into the run folder.
    const { brainRoot } = this.options;
    if (brainRoot === undefined || this.conversationId === "") {
      return undefined;
    }
    return join(brainRoot, this.conversationId);
  }

  private async checkFile(target: OutputTarget): Promise<boolean> {
    const bytes = await this.readOutputFile(target.path);
    if (bytes === undefined) {
      return false;
    }
    const previousSize = this.fileNameToLastSize.get(target.path);
    this.fileNameToLastSize.set(target.path, bytes.length);
    return previousSize === bytes.length && AgyOutputFileUtil.isComplete(target.name, bytes);
  }

  private hasSettled(): boolean {
    return this.isSettled;
  }

  private async handleFilesReady(): Promise<void> {
    if (this.result !== undefined) {
      await this.settleWithResult();
      return;
    }
    this.graceTimer ??= setTimeout(() => {
      void this.settleWithResult();
    }, this.options.timing.resultGraceMs);
  }

  private async handleClose(exitCode: number | null): Promise<void> {
    if (this.isSettled) {
      return;
    }
    const outcome = { exitCode, stdout: this.stdoutText, stderr: this.stderrText, isTimedOut: this.isTimedOut };
    const failure = AgyOutcomeUtil.findProcessFailure(outcome, this.options.timeoutMs, this.options.secrets);
    if (failure instanceof AgyTimeoutError) {
      this.fail(new AgyTimeoutError(this.options.timeoutMs, failure.stderrExcerpt, this.buildLastActivity()));
      return;
    }
    if (failure !== undefined) {
      this.fail(failure);
      return;
    }
    if (this.result === undefined) {
      this.fail(new AgyOutputError("the run ended without a result event"));
      return;
    }
    await this.settleWithResult();
  }

  private async settleWithResult(): Promise<void> {
    if (this.isSettled) {
      return;
    }
    this.isSettled = true;
    this.clearTimers();
    const outputFiles = await this.readExistingFiles();
    const envelope = this.result ?? this.buildSyntheticEnvelope();
    const candidateFileBytes = Object.values(outputFiles).reduce((total, bytes) => total + bytes.length, 0);
    const trace = this.trace.build({
      candidateFileBytes,
      activeSubagentCount: this.activeSubagentIndexes.size,
      candidateFolder: this.candidateFolder,
    });
    await this.stopChild();
    this.resolveRun({ envelope, outputFiles, trace });
  }

  private fail(error: Error): void {
    if (this.isSettled) {
      return;
    }
    this.isSettled = true;
    this.clearTimers();
    void this.stopChild().then(() => {
      this.rejectRun(error);
    });
  }

  private clearTimers(): void {
    clearInterval(this.pollTimer);
    clearTimeout(this.timeoutTimer);
    clearTimeout(this.graceTimer);
    clearTimeout(this.afterResultTimer);
  }

  private stopChild(): Promise<void> {
    const { child, timing } = this.options;
    if (child.exitCode !== null || child.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        this.options.stopProcess();
      }, timing.stopDelayMs);
      child.once("close", () => {
        clearTimeout(killTimer);
        resolve();
      });
      child.stdin?.end();
    });
  }

  private buildSyntheticEnvelope(): AgyEnvelope {
    return {
      conversation_id: this.conversationId,
      status: AgyOutputWatchService.SUCCESS_STATUS,
      response: "",
      usage: AgyOutputWatchService.EMPTY_USAGE,
    };
  }

  private async readExistingFiles(): Promise<AgyOutputFileNameToBytes> {
    const target = await this.findTarget();
    if (target === undefined) {
      return {};
    }
    const bytes = await this.readOutputFile(target.path);
    return bytes === undefined ? {} : { [target.name]: bytes };
  }

  private async readOutputFile(path: string): Promise<Uint8Array | undefined> {
    try {
      return await readFile(path);
    } catch {
      return undefined;
    }
  }
}
