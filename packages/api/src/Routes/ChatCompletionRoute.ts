import type { FastifyInstance, FastifyReply } from "fastify";
import { ChatCompletionRequestSchema } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import type { ChatCompletionService } from "@antigravity-connector/api/Services/ChatCompletionService.ts";
import { ApiErrorUtil } from "@antigravity-connector/api/Utils/ApiErrorUtil.ts";

export class ChatCompletionRoute {
  static readonly PATH = "/v1/chat/completions";

  static readonly IGNORED_PARAMS_HEADER = "x-antigravity-connector-ignored-params";

  static readonly STATUS_OK = 200;

  static readonly INVALID_BODY_MESSAGE = "The body must be a chat completion request with a model and at least one message.";

  static register(app: FastifyInstance, service: ChatCompletionService): void {
    app.post(ChatCompletionRoute.PATH, async (request, reply) => {
      const parsed = ChatCompletionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await ChatCompletionRoute.sendError(
          reply,
          new ApiRequestError("invalid_request_error", null, ChatCompletionRoute.INVALID_BODY_MESSAGE),
        );
        return;
      }
      const controller = new AbortController();
      reply.raw.on("close", () => {
        if (!reply.raw.writableFinished) {
          controller.abort();
        }
      });
      try {
        const outcome = await service.complete(parsed.data, controller.signal);
        if (outcome.ignoredParams.length > 0) {
          reply.header(ChatCompletionRoute.IGNORED_PARAMS_HEADER, outcome.ignoredParams.join(","));
        }
        await reply.code(ChatCompletionRoute.STATUS_OK).send(outcome.body);
      } catch (error: unknown) {
        await ChatCompletionRoute.sendError(reply, error);
      }
    });
  }

  static async sendError(reply: FastifyReply, error: unknown): Promise<void> {
    const response = ApiErrorUtil.build(error);
    await reply.code(response.statusCode).send(response.body);
  }
}
