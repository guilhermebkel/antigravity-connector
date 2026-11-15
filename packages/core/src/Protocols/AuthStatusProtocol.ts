export type AuthStatus = {
  kind: "connected" | "login_required" | "unavailable";
  loginUrl?: string;
  expiresInSeconds?: number;
  reason?: string;
};
