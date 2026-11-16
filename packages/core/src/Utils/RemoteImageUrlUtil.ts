import type { RemoteImageUrlResult } from "@antigravity-connector/core/Protocols/RemoteImageProtocol.ts";

export class RemoteImageUrlUtil {
  static readonly MAX_URL_LENGTH = 2048;

  static parse(url: string): RemoteImageUrlResult {
    if (url.length > RemoteImageUrlUtil.MAX_URL_LENGTH || !URL.canParse(url)) {
      return { isValid: false, reason: "invalid_url" };
    }
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { isValid: false, reason: "not_https" };
    }
    if (parsed.username !== "" || parsed.password !== "") {
      return { isValid: false, reason: "has_credentials" };
    }
    return { isValid: true, url: parsed };
  }
}
