export class AgyOutputFileUtil {
  static readonly PNG_EXTENSION = ".png";

  static readonly JPEG_EXTENSIONS: readonly (".jpg" | ".jpeg")[] = [".jpg", ".jpeg"];

  static readonly IMAGE_EXTENSIONS: readonly (".png" | ".jpg" | ".jpeg")[] = [
    AgyOutputFileUtil.PNG_EXTENSION,
    ...AgyOutputFileUtil.JPEG_EXTENSIONS,
  ];

  static readonly PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

  static readonly PNG_END_MARKER = Buffer.from("49454e44ae426082", "hex");

  static readonly JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");

  static readonly JPEG_END_MARKER = Buffer.from("ffd9", "hex");

  static isImageName(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return AgyOutputFileUtil.IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
  }

  static pickTarget(
    fileNames: readonly string[],
    expectedName: string,
    excludedNames: readonly string[],
  ): string | undefined {
    const candidates = fileNames.filter((name) => AgyOutputFileUtil.isImageName(name) && !excludedNames.includes(name));
    // Why: the picture is the file the run expected by name; without it, the only picture that was not an attachment. Two candidates without the expected name are ambiguous and give none.
    if (candidates.includes(expectedName)) {
      return expectedName;
    }
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  static isComplete(fileName: string, bytes: Uint8Array): boolean {
    if (bytes.length === 0) {
      return false;
    }
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const lower = fileName.toLowerCase();
    if (AgyOutputFileUtil.JPEG_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      return AgyOutputFileUtil.hasMarkers(buffer, AgyOutputFileUtil.JPEG_SIGNATURE, AgyOutputFileUtil.JPEG_END_MARKER);
    }
    if (!lower.endsWith(AgyOutputFileUtil.PNG_EXTENSION)) {
      return true;
    }
    return AgyOutputFileUtil.hasMarkers(buffer, AgyOutputFileUtil.PNG_SIGNATURE, AgyOutputFileUtil.PNG_END_MARKER);
  }

  static hasMarkers(buffer: Buffer, signature: Buffer, endMarker: Buffer): boolean {
    const hasSignature = buffer.subarray(0, signature.length).equals(signature);
    const hasEndMarker = buffer.subarray(-endMarker.length).equals(endMarker);
    return hasSignature && hasEndMarker;
  }
}
