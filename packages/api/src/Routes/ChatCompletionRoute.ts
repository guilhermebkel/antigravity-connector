import type { FastifyInstance, FastifyReply } from "fastify";
import { ChatCompletionRequestSchema, type ChatCompletionRequest } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import type { ChatCompletionService } from "@antigravity-connector/api/Services/ChatCompletionService.ts";
import { ChatStreamService } from "@antigravity-connector/api/Services/ChatStreamService.ts";
import { ApiErrorUtil } from "@antigravity-connector/api/Utils/ApiErrorUtil.ts";
import { ChatChunkUtil } from "@antigravity-connector/api/Utils/ChatChunkUtil.ts";

export type HeaderNameToValue = Record<string, string>;

export type ChatCompletionRouteOptions = { keepAliveMs: number };

export class ChatCompletionRoute {
  static readonly PATH = "/v1/chat/completions";

  static readonly IGNORED_PARAMS_HEADER = "x-antigravity-connector-ignored-params";

  static readonly STATUS_OK = 200;

  static readonly INVALID_BODY_MESSAGE = "The body must be a chat completion request with a model and at least one message.";

  static register(app: FastifyInstance, service: ChatCompletionService, options: ChatCompletionRouteOptions): void {
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
      if (parsed.data.stream === true) {
        await ChatCompletionRoute.streamChat(reply, service, parsed.data, controller.signal, options);
        return;
      }
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

  static async streamChat(
    reply: FastifyReply,
    service: ChatCompletionService,
    body: ChatCompletionRequest,
    signal: AbortSignal,
    options: ChatCompletionRouteOptions,
  ): Promise<void> {
    let opening;
    try {
      opening = await service.openStream(body, signal);
    } catch (error: unknown) {
      await ChatCompletionRoute.sendError(reply, error);
      return;
    }
    reply.hijack();
    const headers: HeaderNameToValue = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    };
    if (opening.ignoredParams.length > 0) {
      headers[ChatCompletionRoute.IGNORED_PARAMS_HEADER] = opening.ignoredParams.join(",");
    }
    reply.raw.writeHead(ChatCompletionRoute.STATUS_OK, headers);
    const keepAlive = setInterval(() => {
      ChatCompletionRoute.writeIfOpen(reply, ChatChunkUtil.KEEP_ALIVE_LINE);
    }, options.keepAliveMs);
    try {
      for await (const line of ChatStreamService.buildLines(opening)) {
        ChatCompletionRoute.writeIfOpen(reply, line);
      }
    } catch (error: unknown) {
      ChatCompletionRoute.writeIfOpen(reply, ChatChunkUtil.formatErrorEvent(ApiErrorUtil.build(error).body));
    } finally {
      clearInterval(keepAlive);
      reply.raw.end();
    }
  }

  static writeIfOpen(reply: FastifyReply, text: string): void {
    if (!reply.raw.writableEnded && !reply.raw.destroyed) {
      reply.raw.write(text);
    }
  }

  static async sendError(reply: FastifyReply, error: unknown): Promise<void> {
    const response = ApiErrorUtil.build(error);
    await reply.code(response.statusCode).send(response.body);
  }
}
