import type { ImageInputReason, ImageMime, RunAttachment } from "@antigravity-connector/core";
import { ImageInputUtil } from "@antigravity-connector/core";
import type { OpenAiContentPart, OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

export class ChatAttachmentUtil {
  static readonly MAX_IMAGES = ImageInputUtil.MAX_IMAGES;

  static readonly MAX_IMAGE_BYTES = ImageInputUtil.MAX_IMAGE_BYTES;

  static readonly REASON_TO_MESSAGE: Readonly<Record<ImageInputReason, string>> = {
    not_data_url: "image_url must be a base64 data: URL of a PNG, JPEG or WebP image. Remote URLs are not fetched.",
    too_large: "An image is larger than 4 MiB.",
    signature_mismatch: "An image does not match its declared type.",
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
    const result = ImageInputUtil.parse(url);
    if (!result.isValid) {
      throw new ApiRequestError("invalid_request_error", "messages", ChatAttachmentUtil.describeReason(result.reason, result.mime));
    }
    return ImageInputUtil.buildAttachment(result.mime, result.bytes, index);
  }

  static describeReason(reason: ImageInputReason, mime: ImageMime | undefined): string {
    if (reason === "signature_mismatch") {
      return `An image does not match its declared type ${mime ?? ""}.`;
    }
    return ChatAttachmentUtil.REASON_TO_MESSAGE[reason];
  }
}
