import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { AgySessionKind } from "@antigravity-connector/core";
import { HttpAuthService } from "@antigravity-connector/server/Services/HttpAuthService.ts";
import { HttpRateLimitService, type RateBucket } from "@antigravity-connector/server/Services/HttpRateLimitService.ts";
import { HealthRoute } from "@antigravity-connector/server/Routes/HealthRoute.ts";
import type { RoutePlugin } from "@antigravity-connector/server/Protocols/RoutePluginProtocol.ts";
import { HttpErrorUtil } from "@antigravity-connector/server/Utils/HttpErrorUtil.ts";
import { HttpPathUtil } from "@antigravity-connector/server/Utils/HttpPathUtil.ts";

export type AppSetupOptions = {
  apiKey: string;
  maxRequestsPerMinute: number;
  clock: () => number;
  readSessionKind: () => AgySessionKind;
  routePlugins: readonly RoutePlugin[];
};

export class AppSetup {
  static readonly MAX_BODY_BYTES = 1048576;

  static async build(options: AppSetupOptions): Promise<FastifyInstance> {
    const app = Fastify({ bodyLimit: AppSetup.MAX_BODY_BYTES, logger: false });
    const auth = new HttpAuthService(options.apiKey);
    const rateLimit = new HttpRateLimitService({
      maxRequestsPerWindow: options.maxRequestsPerMinute,
      clock: options.clock,
    });
    app.setErrorHandler((error: FastifyError, request, reply) => {
      const failure = HttpErrorUtil.readFailure(error.code);
      return HttpErrorUtil.send(reply, HttpPathUtil.readPath(request.url), failure);
    });
    app.addHook("onRequest", (request, reply) => AppSetup.checkRequest(request, reply, auth, rateLimit));
    HealthRoute.register(app, options.readSessionKind);
    for (const plugin of options.routePlugins) {
      await plugin(app);
    }
    return app;
  }

  static async checkRequest(
    request: FastifyRequest,
    reply: FastifyReply,
    auth: HttpAuthService,
    rateLimit: HttpRateLimitService,
  ): Promise<FastifyReply | undefined> {
    const path = HttpPathUtil.readPath(request.url);
    if (path === HttpPathUtil.HEALTH_PATH) {
      return undefined;
    }
    const isAuthorized = auth.isAuthorized(request.headers.authorization);
    const bucket: RateBucket = isAuthorized ? "authenticated" : "failed";
    if (!rateLimit.consume(bucket)) {
      return HttpErrorUtil.send(reply, path, "rate_limited");
    }
    if (!isAuthorized) {
      return HttpErrorUtil.send(reply, path, "unauthorized");
    }
    return undefined;
  }
}
