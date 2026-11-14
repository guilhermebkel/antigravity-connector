import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyTimeoutError extends Error {
  readonly code: OpenAiErrorCode = "agy_timeout";

  readonly stderrExcerpt: string;

  constructor(timeoutMs: number, stderrExcerpt: string) {
    super(`agy did not finish within ${timeoutMs} ms and was stopped`);
    this.name = "AgyTimeoutError";
    this.stderrExcerpt = stderrExcerpt;
  }
}
