import { timingSafeEqual } from "node:crypto";
import { BearerUtil } from "@antigravity-connector/server/Utils/BearerUtil.ts";
import { DigestUtil } from "@antigravity-connector/server/Utils/DigestUtil.ts";

export class HttpAuthService {
  private readonly expectedDigest: Buffer;

  constructor(apiKey: string) {
    this.expectedDigest = DigestUtil.hashSha256(apiKey);
  }

  isAuthorized(authorizationHeader: string | undefined): boolean {
    const token = BearerUtil.readToken(authorizationHeader);
    if (token === undefined) {
      return false;
    }
    return timingSafeEqual(this.expectedDigest, DigestUtil.hashSha256(token));
  }
}
