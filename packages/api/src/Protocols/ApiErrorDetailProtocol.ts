import type { OpenAiErrorCode, OpenAiErrorType } from "@antigravity-connector/protocol";

export type ApiErrorDetail = {
  statusCode: number;
  type: OpenAiErrorType;
  message: string | undefined;
};

export type ApiErrorBody = {
  error: {
    message: string;
    type: OpenAiErrorType;
    param: string | null;
    code: OpenAiErrorCode | null;
  };
};

export type ApiErrorResponse = {
  statusCode: number;
  body: ApiErrorBody;
};
