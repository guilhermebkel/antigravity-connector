import type { FastifyInstance } from "fastify";
import type { AgyRunService } from "@antigravity-connector/core";
import { ChatCompletionRoute } from "@antigravity-connector/api/Routes/ChatCompletionRoute.ts";
import { ModelsRoute } from "@antigravity-connector/api/Routes/ModelsRoute.ts";
import { ChatCompletionService } from "@antigravity-connector/api/Services/ChatCompletionService.ts";

export type ApiSetupOptions = {
  runService: AgyRunService;
  clock: () => number;
};

export class ApiSetup {
  static register(app: FastifyInstance, options: ApiSetupOptions): void {
    const service = new ChatCompletionService({ runService: options.runService, clock: options.clock });
    ModelsRoute.register(app, options.clock);
    ChatCompletionRoute.register(app, service);
  }
}
