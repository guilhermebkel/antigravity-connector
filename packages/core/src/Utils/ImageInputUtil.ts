import type { RunAttachment } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { ImageInputResult, ImageMime } from "@antigravity-connector/core/Protocols/ImageInputProtocol.ts";
import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";

type ImageSignatureCheck = (bytes: Buffer) => boolean;

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");
const RIFF_MARKER = Buffer.from("RIFF", "ascii");
const WEBP_MARKER = Buffer.from("WEBP", "ascii");
const WEBP_MARKER_OFFSET = 8;
const DATA_URL_PREFIX_MAX_LENGTH = 32;
const BASE64_BYTES_PER_GROUP = 3;
const BASE64_CHARS_PER_GROUP = 4;

export class ImageInputUtil {
  static readonly DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

  static readonly MAX_IMAGES = 4;

  static readonly MAX_IMAGE_BYTES = 4194304;

  // Why: a base64 string is 4 characters per 3 bytes, so this bounds an image's data URL before it is decoded.
  static readonly MAX_DATA_URL_LENGTH = Math.ceil(ImageInputUtil.MAX_IMAGE_BYTES / BASE64_BYTES_PER_GROUP)
    * BASE64_CHARS_PER_GROUP + DATA_URL_PREFIX_MAX_LENGTH;

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

  static parse(url: string): ImageInputResult {
    const match = ImageInputUtil.DATA_URL_PATTERN.exec(url);
    if (match === null) {
      return { isValid: false, reason: "not_data_url" };
    }
    const mime = match[1] as ImageMime;
    const bytes = Buffer.from(match[2] ?? "", "base64");
    if (bytes.byteLength > ImageInputUtil.MAX_IMAGE_BYTES) {
      return { isValid: false, reason: "too_large", mime };
    }
    if (!ImageInputUtil.MIME_TO_SIGNATURE_CHECK[mime](bytes)) {
      return { isValid: false, reason: "signature_mismatch", mime };
    }
    return { isValid: true, mime, bytes };
  }

  static readAttachment(url: string, index: number): RunAttachment {
    const result = ImageInputUtil.parse(url);
    if (!result.isValid) {
      throw new ImageInvalidError(`reference image ${index + 1} is not a valid image`);
    }
    return ImageInputUtil.buildAttachment(result.mime, result.bytes, index);
  }

  static buildAttachment(mime: ImageMime, bytes: Uint8Array, index: number): RunAttachment {
    const extension = ImageInputUtil.MIME_TO_EXTENSION[mime];
    return { fileName: `attachment-${index + 1}.${extension}`, bytes };
  }
}
