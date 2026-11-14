import type { OpenAiErrorCode } from "@antigravity-connector/protocol";
import type { RunKind } from "@antigravity-connector/protocol";

export class DailyLimitError extends Error {
  readonly code: OpenAiErrorCode = "daily_limit_reached";

  readonly runKind: RunKind;

  readonly limit: number;

  readonly resetAt: string;

  constructor(runKind: RunKind, limit: number, resetAt: string) {
    super(`The daily limit of ${limit} ${runKind} calls is reached; it resets at ${resetAt}`);
    this.name = "DailyLimitError";
    this.runKind = runKind;
    this.limit = limit;
    this.resetAt = resetAt;
  }
}
