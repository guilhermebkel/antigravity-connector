import type { OpenAiErrorCode } from "@antigravity-connector/protocol";
import type { MediaKind } from "@antigravity-connector/core/Protocols/MediaProtocol.ts";
import { MediaInputUtil } from "@antigravity-connector/core/Utils/MediaInputUtil.ts";

export type ImageUploadReason
  = | "unknown_link"
    | "too_large"
    | "not_an_image"
    | "too_many_links"
    | "image_not_found"
    | "wrong_kind";

export class ImageUploadError extends Error {
  static readonly KIND_TO_NOUN: Readonly<Record<MediaKind, string>> = {
    image: "a picture",
    audio: "an audio file",
    video: "a video file",
  };

  static readonly REASON_TO_TEXT: Readonly<Record<ImageUploadReason, (kind: MediaKind) => string>> = {
    unknown_link: () => "The upload link is unknown, expired or already used. What to do: call create_upload_link again.",
    too_large: (kind) => `The uploaded file is larger than ${MediaInputUtil.formatLimit(kind)}. What to do: send a smaller file.`,
    not_an_image: (kind) => `The uploaded file is not a ${MediaInputUtil.KIND_TO_ACCEPTED_TEXT[kind]}. What to do: send one of those files as the raw request body.`,
    too_many_links: () => "Too many uploads are waiting. What to do: wait a few minutes for them to expire, then call create_upload_link again.",
    image_not_found: () => "A file reference points to an upload that was not found: it expired or never arrived. What to do: call create_upload_link, upload the file again, then retry.",
    wrong_kind: (kind) => `The upload is not ${ImageUploadError.KIND_TO_NOUN[kind]}. What to do: call create_upload_link with kind "${kind}", upload the file, and pass that value.`,
  };

  readonly code: OpenAiErrorCode = "invalid_request_error";

  readonly reason: ImageUploadReason;

  constructor(reason: ImageUploadReason, kind: MediaKind = "image") {
    super(ImageUploadError.REASON_TO_TEXT[reason](kind));
    this.name = "ImageUploadError";
    this.reason = reason;
  }
}
