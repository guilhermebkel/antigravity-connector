import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { AsyncEventBufferService } from "@antigravity-connector/protocol";
import type { ChildProcess } from "node:child_process";
import type {
  AgyCliAdapterOptions,
  AgyEnvNameToValue,
  AgyOutputFileNameToBytes,
  AgyProcessOutcome,
  AgyRunRequest,
  AgyRunResult,
  AgyRunnerPort,
  AgyStreamOutputEvent,
} from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyArgumentUtil } from "@antigravity-connector/agy/Utils/AgyArgumentUtil.ts";
import { AgyEnvUtil } from "@antigravity-connector/agy/Utils/AgyEnvUtil.ts";
import { AgyOutcomeUtil } from "@antigravity-connector/agy/Utils/AgyOutcomeUtil.ts";
import { AgySpawnUtil } from "@antigravity-connector/agy/Utils/AgySpawnUtil.ts";
import { AgyStreamReaderService } from "@antigravity-connector/agy/Services/AgyStreamReaderService.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgyStoppedError } from "@antigravity-connector/agy/Errors/AgyStoppedError.ts";

type AgyStreamRun = {
  buffer: AsyncEventBufferService<AgyStreamOutputEvent>;
  closed: Promise<void>;
  dispose: () => void;
};

export class AgyCliAdapter implements AgyRunnerPort {
  static readonly RUN_DIRECTORY_PREFIX = "agy-run-";

  private readonly binaryPath: string;

  private readonly tempRoot: string;

  private readonly parentEnv: AgyEnvNameToValue;

  private readonly liveChildren = new Set<ChildProcess>();

  private isStopped = false;

  constructor(options: AgyCliAdapterOptions) {
    this.binaryPath = options.binaryPath;
    this.tempRoot = options.tempRoot;
    this.parentEnv = options.parentEnv;
  }

  stopAll(): void {
    this.isStopped = true;
    for (const child of this.liveChildren) {
      AgySpawnUtil.stopProcessGroup(child.pid);
    }
  }

  async run(request: AgyRunRequest): Promise<AgyRunResult> {
    this.assertRunning();
    const workingDirectory = await mkdtemp(join(this.tempRoot, AgyCliAdapter.RUN_DIRECTORY_PREFIX));
    try {
      return await this.runInDirectory(request, workingDirectory);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }

  async* stream(request: AgyRunRequest, signal?: AbortSignal): AsyncGenerator<AgyStreamOutputEvent> {
    this.assertRunning();
    const workingDirectory = await mkdtemp(join(this.tempRoot, AgyCliAdapter.RUN_DIRECTORY_PREFIX));
    try {
      yield* this.streamInDirectory(request, workingDirectory, signal);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }

  private async runInDirectory(request: AgyRunRequest, workingDirectory: string): Promise<AgyRunResult> {
    const args = AgyArgumentUtil.build(request);
    const outcome = await this.runProcess(args, workingDirectory, request.profile.timeoutMs);
    const envelope = AgyOutcomeUtil.readEnvelope(outcome, request.profile.timeoutMs, this.buildSecrets());
    const outputFiles = await this.readOutputFiles(workingDirectory, request.profile.expectedOutputFileNames);
    return { envelope, outputFiles };
  }

  private async* streamInDirectory(
    request: AgyRunRequest,
    workingDirectory: string,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<AgyStreamOutputEvent> {
    const run = this.startStreamProcess(request, workingDirectory, signal);
    try {
      yield* run.buffer.readItems();
    } finally {
      run.dispose();
      await run.closed;
    }
  }

  private startStreamProcess(
    request: AgyRunRequest,
    workingDirectory: string,
    signal: AbortSignal | undefined,
  ): AgyStreamRun {
    const args = AgyArgumentUtil.build(request, "stream-json");
    const childEnv = AgyEnvUtil.build(this.parentEnv);
    const child = this.startTracked(args, workingDirectory, childEnv);
    const buffer = new AsyncEventBufferService<AgyStreamOutputEvent>();
    const reader = new AgyStreamReaderService(buffer, {
      timeoutMs: request.profile.timeoutMs,
      secrets: this.buildSecrets(),
    });
    let isTimedOut = false;
    const stopRun = (): void => {
      AgySpawnUtil.stopProcessGroup(child.pid);
    };
    const timer = setTimeout(() => {
      isTimedOut = true;
      stopRun();
    }, request.profile.timeoutMs);
    const onAbort = (): void => {
      buffer.end(signal?.reason);
      stopRun();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const closed = AgyCliAdapter.attachStreamListeners(child, reader, () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }, () => isTimedOut, buffer);
    return {
      buffer,
      closed,
      dispose: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (child.exitCode === null && child.signalCode === null) {
          stopRun();
        }
      },
    };
  }

  private static attachStreamListeners(
    child: ChildProcess,
    reader: AgyStreamReaderService,
    onSettled: () => void,
    readTimedOut: () => boolean,
    buffer: AsyncEventBufferService<AgyStreamOutputEvent>,
  ): Promise<void> {
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      reader.addStdout(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      reader.addStderr(chunk);
    });
    return new Promise<void>((resolve) => {
      child.on("error", (error: Error) => {
        onSettled();
        buffer.end(error);
        resolve();
      });
      child.on("close", (exitCode: number | null) => {
        onSettled();
        reader.finish(exitCode, readTimedOut());
        resolve();
      });
    });
  }

  private assertRunning(): void {
    if (this.isStopped) {
      throw new AgyStoppedError();
    }
  }

  private startTracked(
    args: readonly string[],
    workingDirectory: string,
    childEnvNameToValue: Readonly<Record<string, string>>,
  ): ChildProcess {
    const child = AgySpawnUtil.startDetached(this.binaryPath, args, workingDirectory, childEnvNameToValue);
    this.liveChildren.add(child);
    const removeChild = (): void => {
      this.liveChildren.delete(child);
    };
    child.once("close", removeChild);
    child.once("error", removeChild);
    return child;
  }

  private buildSecrets(): string[] {
    const apiKey = this.parentEnv.API_KEY;
    return apiKey === undefined ? [] : [apiKey];
  }

  private async readOutputFiles(
    workingDirectory: string,
    fileNames: readonly string[],
  ): Promise<AgyOutputFileNameToBytes> {
    const entries = await Promise.all(fileNames.map((fileName) => this.readOutputFile(workingDirectory, fileName)));
    return Object.fromEntries(entries);
  }

  private async readOutputFile(workingDirectory: string, fileName: string): Promise<[string, Uint8Array]> {
    const filePath = join(workingDirectory, fileName);
    try {
      const bytes = await readFile(filePath);
      return [fileName, bytes];
    } catch {
      throw new AgyOutputError(`the expected output file ${fileName} was not written`);
    }
  }

  private runProcess(args: readonly string[], workingDirectory: string, timeoutMs: number): Promise<AgyProcessOutcome> {
    return new Promise((resolve, reject) => {
      const childEnv = AgyEnvUtil.build(this.parentEnv);
      const child = this.startTracked(args, workingDirectory, childEnv);
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      const timer = setTimeout(() => {
        isTimedOut = true;
        AgySpawnUtil.stopProcessGroup(child.pid);
      }, timeoutMs);
      child.on("error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (exitCode: number | null) => {
        clearTimeout(timer);
        resolve({ exitCode, stdout, stderr, isTimedOut });
      });
    });
  }
}
