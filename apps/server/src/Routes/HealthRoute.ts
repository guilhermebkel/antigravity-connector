import type { FastifyInstance } from "fastify";
import type { AgySessionKind } from "@antigravity-connector/core";
import type { HealthBody } from "@antigravity-connector/server/Protocols/HealthProtocol.ts";
import { HttpPathUtil } from "@antigravity-connector/server/Utils/HttpPathUtil.ts";

export class HealthRoute {
  static readonly STATUS_OK = "ok";

  static register(app: FastifyInstance, readSessionKind: () => AgySessionKind): void {
    app.get(HttpPathUtil.HEALTH_PATH, (): HealthBody => ({
      status: HealthRoute.STATUS_OK,
      agy: readSessionKind(),
    }));
  }
}
