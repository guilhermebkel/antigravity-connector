import type { OpenAiErrorCode } from "@antigravity-connector/protocol";
import type { AgyLastActivity } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export class AgyTimeoutError extends Error {
  readonly code: OpenAiErrorCode = "agy_timeout";

  readonly stderrExcerpt: string;

  readonly lastActivity: AgyLastActivity | undefined;

  constructor(timeoutMs: number, stderrExcerpt: string, lastActivity?: AgyLastActivity) {
    super(`agy did not finish within ${timeoutMs} ms and was stopped`);
    this.name = "AgyTimeoutError";
    this.stderrExcerpt = stderrExcerpt;
    this.lastActivity = lastActivity;
  }
}
