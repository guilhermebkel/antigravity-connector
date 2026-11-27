import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  MediaInputUtil,
  MediaUploadError,
  UploadReferenceUtil,
  type MediaUploadReason,
  type MediaUploadService,
} from "@antigravity-connector/core";
import { UploadTokenParamsSchema } from "@antigravity-connector/mcp/Schemas/CreateUploadLinkSchema.ts";
import { UploadPathUtil } from "@antigravity-connector/mcp/Utils/UploadPathUtil.ts";

export type UploadRouteOptions = { uploads: MediaUploadService };

export class UploadRoute {
  static readonly STATUS_OK = 200;

  static readonly REASON_TO_STATUS: Readonly<Record<MediaUploadReason, number>> = {
    unknown_link: 404,
    too_large: 413,
    unsupported_type: 415,
    too_many_links: 429,
    upload_not_found: 404,
    wrong_kind: 400,
  };

  static register(app: FastifyInstance, options: UploadRouteOptions): void {
    app.register((scope, _unused, done) => {
      scope.removeAllContentTypeParsers();
      scope.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, next) => {
        next(null, body);
      });
      scope.post(
        `${UploadPathUtil.PREFIX}/:token`,
        {
          bodyLimit: MediaInputUtil.MAX_BYTES,
          // Why: an unknown token is refused before the body is read, so nobody without a link makes the server buffer a large file.
          onRequest: (request, reply) => UploadRoute.checkLink(request, reply, options),
        },
        (request, reply) => UploadRoute.handle(request, reply, options),
      );
      done();
    });
  }

  static async checkLink(
    request: FastifyRequest,
    reply: FastifyReply,
    options: UploadRouteOptions,
  ): Promise<FastifyReply | undefined> {
    const token = UploadRoute.readToken(request.params);
    if (token !== undefined && options.uploads.hasLink(token)) {
      return undefined;
    }
    return UploadRoute.sendFailure(reply, new MediaUploadError("unknown_link"));
  }

  static handle(request: FastifyRequest, reply: FastifyReply, options: UploadRouteOptions): FastifyReply {
    const token = UploadRoute.readToken(request.params) ?? "";
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    try {
      const receipt = options.uploads.accept(token, bytes);
      return reply.code(UploadRoute.STATUS_OK).send({
        kind: receipt.kind,
        file: UploadReferenceUtil.build(receipt.uploadId),
        image: UploadReferenceUtil.build(receipt.uploadId),
        mimeType: receipt.mime,
        sizeBytes: receipt.sizeBytes,
      });
    } catch (error: unknown) {
      if (error instanceof MediaUploadError) {
        return UploadRoute.sendFailure(reply, error);
      }
      throw error;
    }
  }

  static readToken(params: unknown): string | undefined {
    const parsed = UploadTokenParamsSchema.safeParse(params);
    return parsed.success ? parsed.data.token : undefined;
  }

  static sendFailure(reply: FastifyReply, error: MediaUploadError): FastifyReply {
    return reply.code(UploadRoute.REASON_TO_STATUS[error.reason]).send({ error: error.message });
  }
}
