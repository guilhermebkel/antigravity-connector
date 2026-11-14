import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyUnavailableError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  constructor(reason: string) {
    super(`agy is unavailable: ${reason}`);
    this.name = "AgyUnavailableError";
  }
}
