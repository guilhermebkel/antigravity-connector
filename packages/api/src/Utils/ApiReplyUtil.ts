import type { FastifyReply } from "fastify";
import { ApiErrorUtil } from "@antigravity-connector/api/Utils/ApiErrorUtil.ts";

export class ApiReplyUtil {
  static async sendError(reply: FastifyReply, error: unknown): Promise<void> {
    const response = ApiErrorUtil.build(error);
    await reply.code(response.statusCode).send(response.body);
  }
}
