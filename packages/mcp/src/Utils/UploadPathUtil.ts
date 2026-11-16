export class UploadPathUtil {
  static readonly PREFIX = "/upload";

  static build(token: string): string {
    return `${UploadPathUtil.PREFIX}/${token}`;
  }

  static isUploadPath(path: string): boolean {
    return path.startsWith(`${UploadPathUtil.PREFIX}/`);
  }
}
