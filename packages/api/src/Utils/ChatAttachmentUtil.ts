import type { RunAttachment } from "@antigravity-connector/core";
import type { OpenAiContentPart, OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import type { ImageMime } from "@antigravity-connector/api/Protocols/ImageMimeProtocol.ts";

type ImageSignatureCheck = (bytes: Buffer) => boolean;

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");
const RIFF_MARKER = Buffer.from("RIFF", "ascii");
const WEBP_MARKER = Buffer.from("WEBP", "ascii");
const WEBP_MARKER_OFFSET = 8;

export class ChatAttachmentUtil {
  static readonly DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

  static readonly MAX_IMAGES = 4;

  static readonly MAX_IMAGE_BYTES = 4194304;

  static readonly MIME_TO_EXTENSION: Readonly<Record<ImageMime, string>> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  static readonly MIME_TO_SIGNATURE_CHECK: Readonly<Record<ImageMime, ImageSignatureCheck>> = {
    "image/png": (bytes) => bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    "image/jpeg": (bytes) => bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE),
    "image/webp": (bytes) => bytes.subarray(0, RIFF_MARKER.length).equals(RIFF_MARKER)
      && bytes.subarray(WEBP_MARKER_OFFSET, WEBP_MARKER_OFFSET + WEBP_MARKER.length).equals(WEBP_MARKER),
  };

  static readAttachments(messages: readonly OpenAiMessage[]): RunAttachment[] {
    const urls = ChatAttachmentUtil.readImageUrls(messages);
    if (urls.length > ChatAttachmentUtil.MAX_IMAGES) {
      throw new ApiRequestError("invalid_request_error", "messages", `At most ${ChatAttachmentUtil.MAX_IMAGES} images per request.`);
    }
    return urls.map((url, index) => ChatAttachmentUtil.readAttachment(url, index));
  }

  static readImageUrls(messages: readonly OpenAiMessage[]): string[] {
    return messages.flatMap((message) => {
      if (typeof message.content === "string") {
        return [];
      }
      return message.content.flatMap((part) => ChatAttachmentUtil.readPartUrls(part));
    });
  }

  static readPartUrls(part: OpenAiContentPart): string[] {
    if (part.type !== "image_url") {
      return [];
    }
    return [part.image_url.url];
  }

  static readAttachment(url: string, index: number): RunAttachment {
    const match = ChatAttachmentUtil.DATA_URL_PATTERN.exec(url);
    if (match === null) {
      throw new ApiRequestError(
        "invalid_request_error",
        "messages",
        "image_url must be a base64 data: URL of a PNG, JPEG or WebP image. Remote URLs are not fetched.",
      );
    }
    const mime = match[1] as ImageMime;
    const bytes = Buffer.from(match[2] ?? "", "base64");
    if (bytes.byteLength > ChatAttachmentUtil.MAX_IMAGE_BYTES) {
      throw new ApiRequestError("invalid_request_error", "messages", "An image is larger than 4 MiB.");
    }
    if (!ChatAttachmentUtil.MIME_TO_SIGNATURE_CHECK[mime](bytes)) {
      throw new ApiRequestError("invalid_request_error", "messages", `An image does not match its declared type ${mime}.`);
    }
    const extension = ChatAttachmentUtil.MIME_TO_EXTENSION[mime];
    return { fileName: `attachment-${index + 1}.${extension}`, bytes };
  }
}
