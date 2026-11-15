import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AgyEnvNameToValue, AgyRunRequest } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import type {
  AgyLoginBeginResult,
  AgyLoginPort,
  AgyLoginSubmitResult,
} from "@antigravity-connector/agy/Protocols/AgyLoginProtocol.ts";
import { AgyArgumentUtil } from "@antigravity-connector/agy/Utils/AgyArgumentUtil.ts";
import { AgyEnvUtil } from "@antigravity-connector/agy/Utils/AgyEnvUtil.ts";
import { AgySpawnUtil } from "@antigravity-connector/agy/Utils/AgySpawnUtil.ts";

type LoginOutcome = {
  loginUrl: string | undefined;
  exitCode: number | null;
};

export type AgyLoginAdapterOptions = {
  binaryPath: string;
  tempRoot: string;
  parentEnv: AgyEnvNameToValue;
  modelSlug: string;
};

type LoginAttempt = {
  child: ChildProcess;
  loginUrl: string;
  closed: Promise<number | null>;
  directory: string;
};

export class AgyLoginAdapter implements AgyLoginPort {
  static readonly PROMPT = "ping";

  // Why: agy prints the login link and reads the pasted code only on a terminal; util-linux script gives it one.
  static readonly SCRIPT_BINARY = "script";

  static readonly SCRIPT_ARGUMENTS: readonly "-qefc"[] = ["-qefc"];

  static readonly SCRIPT_LOG = "/dev/null";

  static readonly SHELL_QUOTE = "'";

  static readonly SHELL_QUOTE_ESCAPE = "'\\''";

  static readonly RUN_DIRECTORY_PREFIX = "agy-login-";

  static readonly URL_LINE_PREFIX = "https://";

  static readonly URL_WAIT_MS = 30000;

  static readonly SUCCESS_EXIT_CODE = 0;

  private readonly binaryPath: string;

  private readonly tempRoot: string;

  private readonly parentEnv: AgyEnvNameToValue;

  private readonly modelSlug: string;

  private attempt: LoginAttempt | undefined = undefined;

  constructor(options: AgyLoginAdapterOptions) {
    this.binaryPath = options.binaryPath;
    this.tempRoot = options.tempRoot;
    this.parentEnv = options.parentEnv;
    this.modelSlug = options.modelSlug;
  }

  async start(): Promise<AgyLoginBeginResult> {
    if (this.attempt !== undefined) {
      return { kind: "started", loginUrl: this.attempt.loginUrl };
    }
    const directory = await mkdtemp(join(this.tempRoot, AgyLoginAdapter.RUN_DIRECTORY_PREFIX));
    const args = AgyArgumentUtil.build(this.buildRequest());
    const command = AgyLoginAdapter.buildCommand(this.binaryPath, args);
    const scriptArgs = [...AgyLoginAdapter.SCRIPT_ARGUMENTS, command, AgyLoginAdapter.SCRIPT_LOG];
    const child = spawn(AgyLoginAdapter.SCRIPT_BINARY, scriptArgs, {
      cwd: directory,
      env: AgyEnvUtil.build(this.parentEnv),
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    const outcome = await AgyLoginAdapter.readLoginOutcome(child);
    if (outcome.loginUrl === undefined) {
      AgySpawnUtil.stopProcessGroup(child.pid);
      await rm(directory, { recursive: true, force: true });
      return AgyLoginAdapter.buildNoLinkResult(outcome.exitCode);
    }
    const loginUrl = outcome.loginUrl;
    const closed = new Promise<number | null>((resolve) => {
      child.once("close", (code) => {
        resolve(code);
      });
    });
    const started: LoginAttempt = { child, loginUrl, closed, directory };
    this.attempt = started;
    void closed.then(async () => {
      if (this.attempt === started) {
        this.attempt = undefined;
      }
      await rm(directory, { recursive: true, force: true });
    });
    return { kind: "started", loginUrl };
  }

  async submit(code: string): Promise<AgyLoginSubmitResult> {
    const attempt = this.attempt;
    if (attempt === undefined) {
      return { kind: "no_attempt" };
    }
    attempt.child.stdin?.on("error", AgyLoginAdapter.onStdinError);
    attempt.child.stdin?.write(`${code}\n`);
    const exitCode = await attempt.closed;
    return { kind: exitCode === 0 ? "connected" : "rejected" };
  }

  stop(): void {
    if (this.attempt !== undefined) {
      AgySpawnUtil.stopProcessGroup(this.attempt.child.pid);
    }
  }

  private buildRequest(): AgyRunRequest {
    return {
      prompt: AgyLoginAdapter.PROMPT,
      modelSlug: this.modelSlug,
      profile: { isPlanMode: true, shouldSkipPermissions: false, timeoutMs: 0, expectedOutputFileNames: [] },
    };
  }

  static buildNoLinkResult(exitCode: number | null): AgyLoginBeginResult {
    if (exitCode === AgyLoginAdapter.SUCCESS_EXIT_CODE) {
      return { kind: "connected" };
    }
    return { kind: "unavailable", reason: "agy did not print a login URL" };
  }

  static readLoginOutcome(child: ChildProcess): Promise<LoginOutcome> {
    return new Promise((resolve) => {
      let output = "";
      let timer: ReturnType<typeof setTimeout> | undefined = undefined;
      const finish = (loginUrl: string | undefined, exitCode: number | null): void => {
        clearTimeout(timer);
        resolve({ loginUrl, exitCode });
      };
      timer = setTimeout(() => {
        finish(AgyLoginAdapter.findUrl(output), null);
      }, AgyLoginAdapter.URL_WAIT_MS);
      const onChunk = (chunk: Buffer | string): void => {
        output += chunk.toString();
        const url = AgyLoginAdapter.findUrl(output);
        if (url !== undefined) {
          finish(url, null);
        }
      };
      child.stdout?.on("data", onChunk);
      child.stderr?.on("data", onChunk);
      child.once("close", (code) => {
        finish(AgyLoginAdapter.findUrl(output), code);
      });
      child.once("error", () => {
        finish(undefined, null);
      });
    });
  }

  static buildCommand(binaryPath: string, args: readonly string[]): string {
    return [binaryPath, ...args].map((value) => AgyLoginAdapter.quote(value)).join(" ");
  }

  static quote(value: string): string {
    const escaped = value.split(AgyLoginAdapter.SHELL_QUOTE).join(AgyLoginAdapter.SHELL_QUOTE_ESCAPE);
    return `${AgyLoginAdapter.SHELL_QUOTE}${escaped}${AgyLoginAdapter.SHELL_QUOTE}`;
  }

  static findUrl(output: string): string | undefined {
    const lines = output.split("\n").map((value) => value.trim());
    return lines.find((value) => value.startsWith(AgyLoginAdapter.URL_LINE_PREFIX));
  }

  static readonly onStdinError = (): void => undefined;
}
