import type { FastifyReply } from "fastify";
import type {
  BodyErrorCode,
  HttpFailureDetail,
  HttpFailureKind,
} from "@antigravity-connector/server/Protocols/HttpFailureProtocol.ts";
import { HttpPathUtil } from "@antigravity-connector/server/Utils/HttpPathUtil.ts";

export class HttpErrorUtil {
  static readonly FAILURE_KIND_TO_DETAIL: Readonly<Record<HttpFailureKind, HttpFailureDetail>> = {
    unauthorized: {
      statusCode: 401,
      plainMessage: "Unauthorized",
      openAiError: {
        message: "Incorrect API key provided.",
        type: "authentication_error",
        param: null,
        code: "invalid_api_key",
      },
    },
    rate_limited: {
      statusCode: 429,
      plainMessage: "Too Many Requests",
      openAiError: {
        message: "Rate limit reached for requests. Retry in a minute.",
        type: "rate_limit_error",
        param: null,
        code: null,
      },
    },
    invalid_json: {
      statusCode: 400,
      plainMessage: "Invalid JSON body",
      openAiError: {
        message: "The request body is not valid JSON.",
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    },
    body_too_large: {
      statusCode: 413,
      plainMessage: "Payload Too Large",
      openAiError: {
        message: "The request body is too large.",
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    },
    internal_error: {
      statusCode: 500,
      plainMessage: "Internal Server Error",
      openAiError: {
        message: "The server failed to handle the request.",
        type: "server_error",
        param: null,
        code: null,
      },
    },
  };

  static readonly BODY_ERROR_CODE_TO_FAILURE: Readonly<Record<BodyErrorCode, HttpFailureKind>> = {
    FST_ERR_CTP_INVALID_JSON_BODY: "invalid_json",
    FST_ERR_CTP_BODY_TOO_LARGE: "body_too_large",
  };

  static readFailure(errorCode: string | undefined): HttpFailureKind {
    if (errorCode === undefined || !HttpErrorUtil.isBodyErrorCode(errorCode)) {
      return "internal_error";
    }
    return HttpErrorUtil.BODY_ERROR_CODE_TO_FAILURE[errorCode];
  }

  static isBodyErrorCode(errorCode: string): errorCode is BodyErrorCode {
    return Object.hasOwn(HttpErrorUtil.BODY_ERROR_CODE_TO_FAILURE, errorCode);
  }

  static send(reply: FastifyReply, path: string, failure: HttpFailureKind): FastifyReply {
    const detail = HttpErrorUtil.FAILURE_KIND_TO_DETAIL[failure];
    if (HttpPathUtil.isOpenAiPath(path)) {
      return reply.code(detail.statusCode).type("application/json; charset=utf-8").send({ error: detail.openAiError });
    }
    return reply.code(detail.statusCode).type("text/plain; charset=utf-8").send(detail.plainMessage);
  }
}
