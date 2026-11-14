import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyOutputError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  constructor(reason: string) {
    super(`agy output is not usable: ${reason}`);
    this.name = "AgyOutputError";
  }
}
