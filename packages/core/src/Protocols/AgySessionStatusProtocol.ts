import type { AgySessionCheckKind } from "@antigravity-connector/agy";

export type AgySessionKind = AgySessionCheckKind | "unchecked";

export type AgySessionStatus = {
  kind: AgySessionKind;
  loginUrl?: string;
  reason?: string;
};
