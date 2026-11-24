import type { OpenAiErrorCode } from "@antigravity-connector/protocol";
import type { AgyLastActivity } from "@antigravity-connector/agy";

export class ImageTimeoutError extends Error {
  static readonly MS_PER_SECOND = 1000;

  readonly code: OpenAiErrorCode = "agy_timeout";

  readonly lastActivity: AgyLastActivity | undefined;

  constructor(lastActivity?: AgyLastActivity) {
    super("agy did not finish the image in time and was stopped.");
    this.name = "ImageTimeoutError";
    this.lastActivity = lastActivity;
  }

  describeActivity(): string | undefined {
    if (this.lastActivity === undefined) {
      return undefined;
    }
    const seconds = Math.round(this.lastActivity.idleMs / ImageTimeoutError.MS_PER_SECOND);
    return `last step: ${this.lastActivity.step}, silent for ${seconds} s`;
  }
}
