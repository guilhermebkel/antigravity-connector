import { createHash } from "node:crypto";

export class DigestUtil {
  static hashSha256(value: string): Buffer {
    return createHash("sha256").update(value).digest();
  }
}
