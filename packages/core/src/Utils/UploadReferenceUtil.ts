export class UploadReferenceUtil {
  static readonly PREFIX = "upload:";

  static readonly PATTERN = /^upload:([A-Za-z0-9_-]{22})$/;

  static build(uploadId: string): string {
    return `${UploadReferenceUtil.PREFIX}${uploadId}`;
  }

  static readUploadId(reference: string): string | undefined {
    return UploadReferenceUtil.PATTERN.exec(reference)?.[1];
  }
}
