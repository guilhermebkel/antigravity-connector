import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AgySessionRequiredError extends Error {
  readonly code: OpenAiErrorCode = "agy_session_required";

  readonly loginUrl: string | undefined;

  constructor(loginUrl: string | undefined) {
    super("agy is not logged in: open the login URL and enter the authorization code");
    this.name = "AgySessionRequiredError";
    this.loginUrl = loginUrl;
  }
}
