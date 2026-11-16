export class UploadReferenceUtil {
  static readonly PREFIX = "upload:";

  static readonly PATTERN = /^upload:([A-Za-z0-9_-]{22})$/;

  static build(imageId: string): string {
    return `${UploadReferenceUtil.PREFIX}${imageId}`;
  }

  static readImageId(reference: string): string | undefined {
    return UploadReferenceUtil.PATTERN.exec(reference)?.[1];
  }
}
