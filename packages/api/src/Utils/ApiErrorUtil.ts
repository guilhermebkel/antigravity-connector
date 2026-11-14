import type { OpenAiErrorCode } from "@antigravity-connector/protocol";
import type { ApiErrorDetail, ApiErrorResponse } from "@antigravity-connector/api/Protocols/ApiErrorDetailProtocol.ts";

export class ApiErrorUtil {
  static readonly UNKNOWN_CODE_MESSAGE = "The server failed to answer the request. Check the container logs.";

  static readonly CODE_TO_DETAIL: Readonly<Record<OpenAiErrorCode, ApiErrorDetail>> = {
    invalid_api_key: { statusCode: 401, type: "authentication_error", message: "Incorrect API key provided." },
    invalid_request_error: { statusCode: 400, type: "invalid_request_error", message: undefined },
    tools_not_supported: { statusCode: 400, type: "invalid_request_error", message: undefined },
    model_not_found: { statusCode: 404, type: "invalid_request_error", message: undefined },
    queue_timeout: {
      statusCode: 503,
      type: "server_error",
      message: "The call waited too long in the queue and did not run. Retry in a moment.",
    },
    daily_limit_reached: { statusCode: 429, type: "rate_limit_error", message: undefined },
    agy_session_required: {
      statusCode: 503,
      type: "server_error",
      message: "agy is not logged in. Run docker logs antigravity-connector to find the login block, then log in with docker exec.",
    },
    agy_failed: { statusCode: 502, type: "server_error", message: "agy failed to answer. Check the container logs and retry." },
    image_not_produced: { statusCode: 502, type: "server_error", message: undefined },
    image_invalid: { statusCode: 502, type: "server_error", message: undefined },
    agy_timeout: {
      statusCode: 504,
      type: "server_error",
      message: "agy did not finish in time and was stopped. Retry, or ask a shorter question.",
    },
  };

  static readonly MESSAGE_FROM_ERROR_CODES: ReadonlySet<OpenAiErrorCode> = new Set<OpenAiErrorCode>([
    "invalid_request_error",
    "tools_not_supported",
    "model_not_found",
    "daily_limit_reached",
    "image_not_produced",
    "image_invalid",
  ]);

  static build(error: unknown): ApiErrorResponse {
    const code = ApiErrorUtil.readCode(error);
    if (code === undefined) {
      return ApiErrorUtil.buildUnknown();
    }
    const detail = ApiErrorUtil.CODE_TO_DETAIL[code];
    const message = ApiErrorUtil.readMessage(code, detail, error);
    return {
      statusCode: detail.statusCode,
      body: { error: { code, message, param: ApiErrorUtil.readParam(error), type: detail.type } },
    };
  }

  static buildUnknown(): ApiErrorResponse {
    return {
      statusCode: 500,
      body: { error: { message: ApiErrorUtil.UNKNOWN_CODE_MESSAGE, type: "server_error", param: null, code: null } },
    };
  }

  static readCode(error: unknown): OpenAiErrorCode | undefined {
    if (!(error instanceof Error) || !("code" in error) || typeof error.code !== "string") {
      return undefined;
    }
    return ApiErrorUtil.isKnownCode(error.code) ? error.code : undefined;
  }

  static isKnownCode(code: string): code is OpenAiErrorCode {
    return Object.hasOwn(ApiErrorUtil.CODE_TO_DETAIL, code);
  }

  static readMessage(code: OpenAiErrorCode, detail: ApiErrorDetail, error: unknown): string {
    if (ApiErrorUtil.MESSAGE_FROM_ERROR_CODES.has(code) && error instanceof Error) {
      return error.message;
    }
    return detail.message ?? ApiErrorUtil.UNKNOWN_CODE_MESSAGE;
  }

  static readParam(error: unknown): string | null {
    if (error instanceof Error && "param" in error && typeof error.param === "string") {
      return error.param;
    }
    return null;
  }
}
