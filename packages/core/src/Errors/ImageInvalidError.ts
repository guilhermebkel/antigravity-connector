import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ImageInvalidError extends Error {
  readonly code: OpenAiErrorCode = "image_invalid";

  readonly reason: string;

  constructor(reason: string) {
    super(`agy produced a file that cannot be returned: ${reason}.`);
    this.name = "ImageInvalidError";
    this.reason = reason;
  }
}
