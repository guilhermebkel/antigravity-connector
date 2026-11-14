export type AgySessionCheckKind = "connected" | "login_required" | "unavailable";

export type AgySessionCheckResult = {
  kind: AgySessionCheckKind;
  loginUrl?: string;
  reason?: string;
};

export interface AgySessionCheckPort { check(): Promise<AgySessionCheckResult> }
