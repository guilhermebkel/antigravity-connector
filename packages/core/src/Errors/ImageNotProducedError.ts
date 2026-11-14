import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ImageNotProducedError extends Error {
  readonly code: OpenAiErrorCode = "image_not_produced";

  constructor() {
    super("agy finished but produced no image. Retry, or describe the image in more detail.");
    this.name = "ImageNotProducedError";
  }
}
