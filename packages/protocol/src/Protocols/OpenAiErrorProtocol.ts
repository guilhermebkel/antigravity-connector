export type OpenAiErrorCode
  = | "invalid_api_key"
    | "invalid_request_error"
    | "tools_not_supported"
    | "model_not_found"
    | "queue_timeout"
    | "daily_limit_reached"
    | "agy_session_required"
    | "agy_failed"
    | "agy_timeout";

export type OpenAiErrorType = "invalid_request_error" | "authentication_error" | "rate_limit_error" | "server_error";

export type OpenAiError = {
  error: {
    message: string;
    type: OpenAiErrorType;
    param: string | null;
    code: OpenAiErrorCode | null;
  };
};
