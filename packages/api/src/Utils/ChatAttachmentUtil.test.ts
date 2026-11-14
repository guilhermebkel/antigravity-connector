import { describe, expect, it } from "vitest";
import type { OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ChatAttachmentUtil } from "@antigravity-connector/api/Utils/ChatAttachmentUtil.ts";

const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d", "hex");
const JPEG_BYTES = Buffer.from("ffd8ffe000104a46", "hex");
const WEBP_BYTES = Buffer.from("524946463a000000574542505650382000000000", "hex");

const buildDataUrl = (mime: string, bytes: Buffer): string => `data:${mime};base64,${bytes.toString("base64")}`;

const buildMessages = (urls: string[]): OpenAiMessage[] => [{
  role: "user",
  content: urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
}];

describe("ChatAttachmentUtil.readAttachments", () => {
  it("AC1: a base64 PNG becomes an attachment with its bytes", () => {
    const [attachment] = ChatAttachmentUtil.readAttachments(buildMessages([buildDataUrl("image/png", PNG_BYTES)]));

    expect(attachment?.fileName).toBe("attachment-1.png");
    expect(Buffer.from(attachment?.bytes ?? new Uint8Array())).toStrictEqual(PNG_BYTES);
  });

  it("accepts JPEG and WebP with their own extensions", () => {
    const attachments = ChatAttachmentUtil.readAttachments(buildMessages([
      buildDataUrl("image/jpeg", JPEG_BYTES),
      buildDataUrl("image/webp", WEBP_BYTES),
    ]));

    expect(attachments.map((attachment) => attachment.fileName)).toStrictEqual(["attachment-1.jpg", "attachment-2.webp"]);
  });

  it("AC2: a remote https URL is refused and nothing is fetched", () => {
    expect(() => ChatAttachmentUtil.readAttachments(buildMessages(["https://example.com/a.png"])))
      .toThrow(/Remote URLs are not fetched/);
  });

  it("AC3: bytes that do not match the declared type are refused", () => {
    expect(() => ChatAttachmentUtil.readAttachments(buildMessages([buildDataUrl("image/png", Buffer.from("not a png"))])))
      .toThrow(/does not match/);
  });

  it("refuses more images than the per-request maximum", () => {
    const urls = Array.from({ length: ChatAttachmentUtil.MAX_IMAGES + 1 }, () => buildDataUrl("image/png", PNG_BYTES));

    expect(() => ChatAttachmentUtil.readAttachments(buildMessages(urls))).toThrow(ApiRequestError);
  });

  it("AC3: an image larger than 4 MiB is refused", () => {
    const padding = Buffer.alloc(ChatAttachmentUtil.MAX_IMAGE_BYTES);
    const oversized = buildDataUrl("image/png", Buffer.concat([PNG_BYTES, padding]));

    expect(() => ChatAttachmentUtil.readAttachments(buildMessages([oversized]))).toThrow(/larger than 4 MiB/);
  });
});
