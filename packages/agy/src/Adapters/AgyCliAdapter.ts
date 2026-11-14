import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgyCliAdapterOptions,
  AgyEnvNameToValue,
  AgyOutputFileNameToBytes,
  AgyProcessOutcome,
  AgyRunRequest,
  AgyRunResult,
  AgyRunnerPort,
} from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyArgumentUtil } from "@antigravity-connector/agy/Utils/AgyArgumentUtil.ts";
import { AgyEnvUtil } from "@antigravity-connector/agy/Utils/AgyEnvUtil.ts";
import { AgyOutcomeUtil } from "@antigravity-connector/agy/Utils/AgyOutcomeUtil.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";

export class AgyCliAdapter implements AgyRunnerPort {
  static readonly RUN_DIRECTORY_PREFIX = "agy-run-";

  static readonly KILL_SIGNAL = "SIGKILL";

  static readonly NO_SUCH_PROCESS_CODE = "ESRCH";

  private readonly binaryPath: string;

  private readonly tempRoot: string;

  private readonly parentEnv: AgyEnvNameToValue;

  constructor(options: AgyCliAdapterOptions) {
    this.binaryPath = options.binaryPath;
    this.tempRoot = options.tempRoot;
    this.parentEnv = options.parentEnv;
  }

  async run(request: AgyRunRequest): Promise<AgyRunResult> {
    const workingDirectory = await mkdtemp(join(this.tempRoot, AgyCliAdapter.RUN_DIRECTORY_PREFIX));
    try {
      return await this.runInDirectory(request, workingDirectory);
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

  private runProcess(
    args: readonly string[],
    workingDirectory: string,
    timeoutMs: number,
  ): Promise<AgyProcessOutcome> {
    return new Promise((resolve, reject) => {
      const childEnv = AgyEnvUtil.build(this.parentEnv);
      const child = spawn(this.binaryPath, args, {
        cwd: workingDirectory,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      const timer = setTimeout(() => {
        isTimedOut = true;
        AgyCliAdapter.stopProcessGroup(child.pid);
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

  static stopProcessGroup(pid: number | undefined): void {
    if (pid === undefined) {
      return;
    }
    try {
      process.kill(-pid, AgyCliAdapter.KILL_SIGNAL);
    } catch (error) {
      const isAlreadyGone
        = error instanceof Error && "code" in error && error.code === AgyCliAdapter.NO_SUCH_PROCESS_CODE;
      if (!isAlreadyGone) {
        throw error;
      }
    }
  }
}
