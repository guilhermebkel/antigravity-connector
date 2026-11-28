import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";

export type ImageOutputMime = "image/png" | "image/jpeg";

export class ImageOutputUtil {
  static readonly PNG_SIGNATURE: Uint8Array = new Uint8Array(Buffer.from("89504e470d0a1a0a", "hex"));

  static readonly JPEG_SIGNATURE: Uint8Array = new Uint8Array(Buffer.from("ffd8ff", "hex"));

  static readonly MAX_BYTES = 8388608;

  static readonly OUTPUT_FILE_NAME = "output.png";

  static readonly IMAGE_NAME_PATTERN = /\.(png|jpe?g)$/i;

  static assertPng(bytes: Uint8Array): void {
    if (bytes.byteLength > ImageOutputUtil.MAX_BYTES) {
      throw new ImageInvalidError("the file is larger than 8 MB");
    }
    if (!ImageOutputUtil.hasPngSignature(bytes)) {
      throw new ImageInvalidError("the file is not a PNG image");
    }
  }

  static assertImage(bytes: Uint8Array): ImageOutputMime {
    // Why: the mime type comes from the bytes, not the file name, so a JPEG saved as .png (or the reverse) is still sent with its real type.
    if (bytes.byteLength > ImageOutputUtil.MAX_BYTES) {
      throw new ImageInvalidError("the file is larger than 8 MB");
    }
    if (ImageOutputUtil.hasPngSignature(bytes)) {
      return "image/png";
    }
    if (ImageOutputUtil.hasJpegSignature(bytes)) {
      return "image/jpeg";
    }
    throw new ImageInvalidError("the file is not a PNG or JPEG image");
  }

  static findImage(fileNameToBytes: Readonly<Record<string, Uint8Array>>): Uint8Array | undefined {
    // Why: output.png is the name the prompt asks for; any other picture in the run's folder is the one agy saved in another format.
    const preferred = fileNameToBytes[ImageOutputUtil.OUTPUT_FILE_NAME];
    if (preferred !== undefined) {
      return preferred;
    }
    const name = Object.keys(fileNameToBytes).find((fileName) => ImageOutputUtil.IMAGE_NAME_PATTERN.test(fileName));
    return name === undefined ? undefined : fileNameToBytes[name];
  }

  static hasPngSignature(bytes: Uint8Array): boolean {
    return ImageOutputUtil.PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }

  static hasJpegSignature(bytes: Uint8Array): boolean {
    return ImageOutputUtil.JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }
}
