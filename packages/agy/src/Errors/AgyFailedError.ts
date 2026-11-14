import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyFailedError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  readonly exitCode: number | null;

  readonly stderrExcerpt: string;

  constructor(exitCode: number | null, stderrExcerpt: string) {
    super(`agy failed with exit code ${exitCode ?? "none"}: ${stderrExcerpt}`);
    this.name = "AgyFailedError";
    this.exitCode = exitCode;
    this.stderrExcerpt = stderrExcerpt;
  }
}
