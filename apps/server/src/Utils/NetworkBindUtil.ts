import { HttpBindForbiddenError } from "@antigravity-connector/server/Errors/HttpBindForbiddenError.ts";

type LoopbackName = "localhost" | "::1";

export class NetworkBindUtil {
  static readonly LOOPBACK_NAMES: readonly LoopbackName[] = ["localhost", "::1"];

  static readonly IPV4_LOOPBACK_PREFIX = "127.";

  static isLoopback(host: string): boolean {
    const isLoopbackName = NetworkBindUtil.LOOPBACK_NAMES.some((name) => name === host);
    return isLoopbackName || host.startsWith(NetworkBindUtil.IPV4_LOOPBACK_PREFIX);
  }

  static assertBindAllowed(host: string, isNonLoopbackAllowed: boolean): void {
    if (NetworkBindUtil.isLoopback(host) || isNonLoopbackAllowed) {
      return;
    }
    throw new HttpBindForbiddenError(host);
  }
}
