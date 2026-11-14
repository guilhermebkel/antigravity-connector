import type { FastifyInstance } from "fastify";
import { ImageGenerationRequestSchema } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import type { ImageGenerationService } from "@antigravity-connector/api/Services/ImageGenerationService.ts";
import { ApiReplyUtil } from "@antigravity-connector/api/Utils/ApiReplyUtil.ts";

export class ImagesRoute {
  static readonly PATH = "/v1/images/generations";

  static readonly IGNORED_PARAMS_HEADER = "x-antigravity-connector-ignored-params";

  static readonly STATUS_OK = 200;

  static readonly INVALID_BODY_MESSAGE = "The body must be an image generation request with a prompt.";

  static register(app: FastifyInstance, service: ImageGenerationService): void {
    app.post(ImagesRoute.PATH, async (request, reply) => {
      const parsed = ImageGenerationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await ApiReplyUtil.sendError(
          reply,
          new ApiRequestError("invalid_request_error", null, ImagesRoute.INVALID_BODY_MESSAGE),
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
        const outcome = await service.generate(parsed.data, controller.signal);
        if (outcome.ignoredParams.length > 0) {
          reply.header(ImagesRoute.IGNORED_PARAMS_HEADER, outcome.ignoredParams.join(","));
        }
        await reply.code(ImagesRoute.STATUS_OK).send(outcome.body);
      } catch (error: unknown) {
        await ApiReplyUtil.sendError(reply, error);
      }
    });
  }
}
