import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class QueueTimeoutError extends Error {
  readonly code: OpenAiErrorCode = "queue_timeout";

  constructor(maxWaitMs: number) {
    super(`The call waited longer than ${maxWaitMs} ms in the queue and was not run`);
    this.name = "QueueTimeoutError";
  }
}
