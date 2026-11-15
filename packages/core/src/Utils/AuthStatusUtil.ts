import type { AuthStatus } from "@antigravity-connector/core/Protocols/AuthStatusProtocol.ts";

export type AuthStatusResponse = {
  status: AuthStatus["kind"];
  login_url?: string;
  expires_in_seconds?: number;
  reason?: string;
};

export class AuthStatusUtil {
  static buildResponse(status: AuthStatus): AuthStatusResponse {
    return {
      status: status.kind,
      login_url: status.loginUrl,
      expires_in_seconds: status.expiresInSeconds,
      reason: status.reason,
    };
  }
}
