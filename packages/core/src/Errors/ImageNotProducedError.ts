import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ImageNotProducedError extends Error {
  readonly code: OpenAiErrorCode = "image_not_produced";

  readonly reason: string | undefined;

  constructor(reason?: string) {
    const trimmed = reason?.trim() ?? "";
    super(
      trimmed === ""
        ? "agy finished but produced no image. Retry, or describe the image in more detail."
        : `agy finished but produced no image. agy said: ${trimmed}`,
    );
    this.name = "ImageNotProducedError";
    this.reason = trimmed === "" ? undefined : trimmed;
  }
}
