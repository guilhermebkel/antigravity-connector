import type { FastifyInstance } from "fastify";
import { ImageRunService, type AgyRunService } from "@antigravity-connector/core";
import { ChatCompletionRoute } from "@antigravity-connector/api/Routes/ChatCompletionRoute.ts";
import { ImagesRoute } from "@antigravity-connector/api/Routes/ImagesRoute.ts";
import { ModelsRoute } from "@antigravity-connector/api/Routes/ModelsRoute.ts";
import { ChatCompletionService } from "@antigravity-connector/api/Services/ChatCompletionService.ts";
import { ConversationRegistryService } from "@antigravity-connector/api/Services/ConversationRegistryService.ts";
import { ImageGenerationService } from "@antigravity-connector/api/Services/ImageGenerationService.ts";

export type ApiSetupOptions = {
  runService: AgyRunService;
  clock: () => number;
  keepAliveMs?: number;
};

export class ApiSetup {
  static readonly KEEP_ALIVE_MS = 15000;

  static register(app: FastifyInstance, options: ApiSetupOptions): void {
    const conversations = new ConversationRegistryService({ clock: options.clock });
    const service = new ChatCompletionService({
      runService: options.runService,
      clock: options.clock,
      conversations,
    });
    const imageService = new ImageGenerationService({
      imageService: new ImageRunService({ runService: options.runService }),
      clock: options.clock,
    });
    ModelsRoute.register(app, options.clock);
    ChatCompletionRoute.register(app, service, { keepAliveMs: options.keepAliveMs ?? ApiSetup.KEEP_ALIVE_MS });
    ImagesRoute.register(app, imageService);
  }
}
