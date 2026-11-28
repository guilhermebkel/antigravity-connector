import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ImageQuotaError extends Error {
  readonly code: OpenAiErrorCode = "image_quota_exhausted";

  readonly resetAt: string;

  constructor(resetAt: string, minutesLeft: number) {
    super(
      `The image quota of the subscription is used up, so no image was made. It resets at ${resetAt}, in about ${minutesLeft} minutes. What to do: retry after that time.`,
    );
    this.name = "ImageQuotaError";
    this.resetAt = resetAt;
  }
}
