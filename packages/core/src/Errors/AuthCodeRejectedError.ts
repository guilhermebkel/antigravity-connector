import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class AuthCodeRejectedError extends Error {
  readonly code: OpenAiErrorCode = "agy_session_required";

  constructor() {
    super("The code was refused or has expired. Call check auth for a new login link, then send the new code.");
    this.name = "AuthCodeRejectedError";
  }
}
