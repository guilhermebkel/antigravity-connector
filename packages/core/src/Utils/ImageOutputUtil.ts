import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";

export class ImageOutputUtil {
  static readonly PNG_SIGNATURE: Uint8Array = new Uint8Array(Buffer.from("89504e470d0a1a0a", "hex"));

  static readonly MAX_BYTES = 8388608;

  static assertPng(bytes: Uint8Array): void {
    if (bytes.byteLength > ImageOutputUtil.MAX_BYTES) {
      throw new ImageInvalidError("the file is larger than 8 MB");
    }
    if (!ImageOutputUtil.hasPngSignature(bytes)) {
      throw new ImageInvalidError("the file is not a PNG image");
    }
  }

  static hasPngSignature(bytes: Uint8Array): boolean {
    return ImageOutputUtil.PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }
}
