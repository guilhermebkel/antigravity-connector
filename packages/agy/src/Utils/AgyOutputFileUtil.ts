export class AgyOutputFileUtil {
  static readonly PNG_EXTENSION = ".png";

  static readonly PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

  static readonly PNG_END_MARKER = Buffer.from("49454e44ae426082", "hex");

  static isComplete(fileName: string, bytes: Uint8Array): boolean {
    if (bytes.length === 0) {
      return false;
    }
    if (!fileName.endsWith(AgyOutputFileUtil.PNG_EXTENSION)) {
      return true;
    }
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signature = AgyOutputFileUtil.PNG_SIGNATURE;
    const endMarker = AgyOutputFileUtil.PNG_END_MARKER;
    const hasSignature = buffer.subarray(0, signature.length).equals(signature);
    const hasEndMarker = buffer.subarray(-endMarker.length).equals(endMarker);
    return hasSignature && hasEndMarker;
  }
}
