import type { OpenAiError } from "@antigravity-connector/protocol";

export type HttpFailureKind = "unauthorized" | "rate_limited" | "invalid_json" | "body_too_large" | "internal_error";

export type BodyErrorCode = "FST_ERR_CTP_INVALID_JSON_BODY" | "FST_ERR_CTP_BODY_TOO_LARGE";

export type HttpFailureDetail = {
  statusCode: number;
  plainMessage: string;
  openAiError: OpenAiError["error"];
};
