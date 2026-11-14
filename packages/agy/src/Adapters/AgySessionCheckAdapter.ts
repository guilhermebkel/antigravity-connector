import type {
  AgyRunRequest,
  AgyRunnerPort,
} from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import type {
  AgySessionCheckPort,
  AgySessionCheckResult,
} from "@antigravity-connector/agy/Protocols/AgySessionCheckProtocol.ts";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgySessionRequiredError } from "@antigravity-connector/agy/Errors/AgySessionRequiredError.ts";
import { AgyTimeoutError } from "@antigravity-connector/agy/Errors/AgyTimeoutError.ts";

export type AgySessionCheckOptions = {
  runner: AgyRunnerPort;
  modelSlug: string;
  timeoutMs: number;
  prompt?: string;
};

export class AgySessionCheckAdapter implements AgySessionCheckPort {
  static readonly DEFAULT_PROMPT = "ping";

  static readonly LOGIN_URL_PREFIX = "https://accounts.google.com/";

  static readonly ENOENT_CODE = "ENOENT";

  private readonly runner: AgyRunnerPort;

  private readonly modelSlug: string;

  private readonly timeoutMs: number;

  private readonly prompt: string;

  constructor(options: AgySessionCheckOptions) {
    this.runner = options.runner;
    this.modelSlug = options.modelSlug;
    this.timeoutMs = options.timeoutMs;
    this.prompt = options.prompt ?? AgySessionCheckAdapter.DEFAULT_PROMPT;
  }

  async check(): Promise<AgySessionCheckResult> {
    try {
      await this.runner.run(this.buildRequest());
      return { kind: "connected" };
    } catch (error: unknown) {
      return AgySessionCheckAdapter.buildResult(error, this.timeoutMs);
    }
  }

  private buildRequest(): AgyRunRequest {
    return {
      prompt: this.prompt,
      modelSlug: this.modelSlug,
      profile: {
        isPlanMode: true,
        shouldSkipPermissions: false,
        timeoutMs: this.timeoutMs,
        expectedOutputFileNames: [],
      },
    };
  }

  static buildResult(error: unknown, timeoutMs: number): AgySessionCheckResult {
    if (error instanceof AgySessionRequiredError) {
      return AgySessionCheckAdapter.buildLoginResult(error.loginUrl);
    }
    if (error instanceof AgyTimeoutError) {
      return { kind: "unavailable", reason: `agy did not answer within ${timeoutMs} ms` };
    }
    if (error instanceof AgyOutputError || error instanceof AgyFailedError) {
      return { kind: "unavailable", reason: `agy answered unexpectedly: ${error.message}` };
    }
    if (AgySessionCheckAdapter.isMissingBinary(error)) {
      return { kind: "unavailable", reason: `agy binary not found: ${error.message}` };
    }
    const message = error instanceof Error ? error.message : "unknown error";
    return { kind: "unavailable", reason: `agy could not be run: ${message}` };
  }

  static buildLoginResult(loginUrl: string | undefined): AgySessionCheckResult {
    const isExpectedHost = loginUrl?.startsWith(AgySessionCheckAdapter.LOGIN_URL_PREFIX) === true;
    if (loginUrl === undefined || !isExpectedHost) {
      return { kind: "unavailable", reason: "agy asked to log in without a login URL on the expected host" };
    }
    return { kind: "login_required", loginUrl };
  }

  static isMissingBinary(error: unknown): error is Error {
    return error instanceof Error && "code" in error && error.code === AgySessionCheckAdapter.ENOENT_CODE;
  }
}
