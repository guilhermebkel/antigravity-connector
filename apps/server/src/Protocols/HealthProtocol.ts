import type { AgySessionKind } from "@antigravity-connector/core";

export type HealthBody = {
  status: "ok";
  agy: AgySessionKind;
};
