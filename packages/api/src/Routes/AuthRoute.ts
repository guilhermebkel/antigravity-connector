import type { FastifyInstance } from "fastify";
import { AuthAttemptMissingError, AuthCodeRejectedError, AuthStatusUtil, type AgyLoginService } from "@antigravity-connector/core";
import { AuthCodeRequestSchema } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ApiReplyUtil } from "@antigravity-connector/api/Utils/ApiReplyUtil.ts";

export class AuthRoute {
  static readonly PATH = "/v1/auth";

  static readonly STATUS_OK = 200;

  static readonly INVALID_BODY_MESSAGE = "The body must be {\"code\": \"<the Google authorization code>\"}.";

  static register(app: FastifyInstance, loginService: AgyLoginService): void {
    app.get(AuthRoute.PATH, async (_request, reply) => {
      try {
        const status = await loginService.readStatus();
        await reply.code(AuthRoute.STATUS_OK).send(AuthStatusUtil.buildResponse(status));
      } catch (error: unknown) {
        await ApiReplyUtil.sendError(reply, error);
      }
    });
    app.post(AuthRoute.PATH, async (request, reply) => {
      const parsed = AuthCodeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await ApiReplyUtil.sendError(
          reply,
          new ApiRequestError("invalid_request_error", "code", AuthRoute.INVALID_BODY_MESSAGE),
        );
        return;
      }
      try {
        const status = await loginService.submitCode(parsed.data.code);
        await reply.code(AuthRoute.STATUS_OK).send(AuthStatusUtil.buildResponse(status));
      } catch (error: unknown) {
        await ApiReplyUtil.sendError(reply, AuthRoute.mapError(error));
      }
    });
  }

  static mapError(error: unknown): unknown {
    if (error instanceof AuthAttemptMissingError || error instanceof AuthCodeRejectedError) {
      return new ApiRequestError("invalid_request_error", "code", error.message);
    }
    return error;
  }
}
