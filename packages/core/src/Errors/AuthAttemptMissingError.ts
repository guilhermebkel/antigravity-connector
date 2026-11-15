import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AuthAttemptMissingError extends Error {
  readonly code: OpenAiErrorCode = "agy_session_required";

  constructor() {
    super("No login is in progress. Call check auth first to get a login link, then send the code.");
    this.name = "AuthAttemptMissingError";
  }
}
