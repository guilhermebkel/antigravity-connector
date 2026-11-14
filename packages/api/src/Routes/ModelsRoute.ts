import type { FastifyInstance } from "fastify";
import { ModelCatalogueUtil, type ModelList } from "@antigravity-connector/protocol";

export class ModelsRoute {
  static readonly PATH = "/v1/models";

  static readonly OWNER = "antigravity-connector";

  static readonly MS_PER_SECOND = 1000;

  static register(app: FastifyInstance, clock: () => number): void {
    app.get(ModelsRoute.PATH, (): ModelList => {
      const created = Math.floor(clock() / ModelsRoute.MS_PER_SECOND);
      return {
        object: "list",
        data: ModelCatalogueUtil.listModelIds().map((id) => ({
          id,
          created,
          object: "model",
          owned_by: ModelsRoute.OWNER,
        })),
      };
    });
  }
}
