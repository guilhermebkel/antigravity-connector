import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyStoppedError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  constructor() {
    super("The server is shutting down and does not start new agy runs");
    this.name = "AgyStoppedError";
  }
}
