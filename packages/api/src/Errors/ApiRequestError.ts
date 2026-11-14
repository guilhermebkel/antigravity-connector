import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ApiRequestError extends Error {
  readonly code: OpenAiErrorCode;

  readonly param: string | null;

  constructor(code: OpenAiErrorCode, param: string | null, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.param = param;
  }
}
