import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export type ImageUploadReason
  = | "unknown_link"
    | "too_large"
    | "not_an_image"
    | "too_many_links"
    | "image_not_found";

export class ImageUploadError extends Error {
  static readonly REASON_TO_TEXT: Readonly<Record<ImageUploadReason, string>> = {
    unknown_link: "The upload link is unknown, expired or already used. What to do: call create_upload_link again.",
    too_large: "The uploaded file is larger than 4 MiB. What to do: send a smaller picture.",
    not_an_image: "The uploaded file is not a PNG, JPEG or WebP picture. What to do: send one of those files as the raw request body.",
    too_many_links: "Too many uploads are waiting. What to do: wait a few minutes for them to expire, then call create_upload_link again.",
    image_not_found: "A reference image points to an upload that was not found: it expired or never arrived. What to do: call create_upload_link, upload the picture again, then retry.",
  };

  readonly code: OpenAiErrorCode = "invalid_request_error";

  readonly reason: ImageUploadReason;

  constructor(reason: ImageUploadReason) {
    super(ImageUploadError.REASON_TO_TEXT[reason]);
    this.name = "ImageUploadError";
    this.reason = reason;
  }
}
