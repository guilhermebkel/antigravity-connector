export type AuthStatusKind = "connected" | "login_required" | "unavailable";

export type AuthStatusResponse = {
  status: AuthStatusKind;
  login_url?: string;
  expires_in_seconds?: number;
  reason?: string;
};

export type AuthCodeRequest = { code: string };
