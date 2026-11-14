import type { AgyStatus } from "@antigravity-connector/protocol/Protocols/AgyEnvelopeProtocol.ts";

export class AgyStatusUtil {
  static readonly KNOWN_STATUSES: readonly AgyStatus[] = ["SUCCESS", "ERROR"];

  static parse(value: string): AgyStatus {
    return AgyStatusUtil.KNOWN_STATUSES.find((status) => status === value) ?? "unknown";
  }
}
