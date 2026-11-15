import { describe, expect, it } from "vitest";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";
import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";

const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d", "hex");
const JPEG_BYTES = Buffer.from("ffd8ffe000104a46", "hex");

const buildDataUrl = (mime: string, bytes: Buffer): string => `data:${mime};base64,${bytes.toString("base64")}`;

describe("ImageInputUtil", () => {
  it("a PNG or JPEG data URL is parsed, and its attachment is named by position and type", () => {
    const png = ImageInputUtil.parse(buildDataUrl("image/png", PNG_BYTES));
    expect(png.isValid).toBe(true);
    expect(ImageInputUtil.readAttachment(buildDataUrl("image/jpeg", JPEG_BYTES), 1).fileName).toBe("attachment-2.jpg");
  });

  it("a remote URL is not a data URL", () => {
    expect(ImageInputUtil.parse("https://example.com/a.png")).toStrictEqual({ isValid: false, reason: "not_data_url" });
  });

  it("bytes that do not match the declared type are refused", () => {
    const result = ImageInputUtil.parse(buildDataUrl("image/png", JPEG_BYTES));
    expect(result).toStrictEqual({
      isValid: false,
      reason: "signature_mismatch",
      mime: "image/png",
    });
  });

  it("an image over 4 MiB is refused before its signature is checked", () => {
    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(ImageInputUtil.MAX_IMAGE_BYTES)]);
    const result = ImageInputUtil.parse(buildDataUrl("image/png", oversized));
    expect(result).toStrictEqual({
      isValid: false,
      reason: "too_large",
      mime: "image/png",
    });
  });

  it("readAttachment refuses an invalid image with ImageInvalidError", () => {
    expect(() => ImageInputUtil.readAttachment("https://example.com/a.png", 0)).toThrow(ImageInvalidError);
  });
});
