import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgyAbortedError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  constructor() {
    super("The call was cancelled by the client, and agy was stopped");
    this.name = "AgyAbortedError";
  }
}
