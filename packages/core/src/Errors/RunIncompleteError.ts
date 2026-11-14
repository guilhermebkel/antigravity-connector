import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class RunIncompleteError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  constructor() {
    super("agy stopped before it returned an answer");
    this.name = "RunIncompleteError";
  }
}
