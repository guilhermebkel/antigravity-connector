import type { FastifyInstance } from "fastify";
import {
  HttpsImageDownloadAdapter,
  ImageRunService,
  ImageSourceService,
  type AgyLoginService,
  type AgyRunService,
  type RemoteImageDownloadPort,
} from "@antigravity-connector/core";
import { McpSessionService } from "@antigravity-connector/mcp/Services/McpSessionService.ts";
import { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";
import { McpRoute } from "@antigravity-connector/mcp/Routes/McpRoute.ts";

export type McpSetupOptions = {
  runService: AgyRunService;
  clock: () => number;
  sessionTtlMs: number;
  maxSessions: number;
  researchDailyLimit: number;
  loginService: AgyLoginService;
  jobWaitMs?: number;
  imageDownloader?: RemoteImageDownloadPort;
};

export class McpSetup {
  static register(app: FastifyInstance, options: McpSetupOptions): void {
    const sessions = new McpSessionService({
      ttlMs: options.sessionTtlMs,
      maxSessions: options.maxSessions,
      clock: options.clock,
    });
    const services = {
      runService: options.runService,
      imageService: new ImageRunService({ runService: options.runService }),
      imageSourceService: new ImageSourceService({
        downloader: options.imageDownloader ?? new HttpsImageDownloadAdapter(),
      }),
      toolJobs: new ToolJobService({ clock: options.clock, waitMs: options.jobWaitMs }),
      researchDailyLimit: options.researchDailyLimit,
      loginService: options.loginService,
    };
    McpRoute.register(app, { services, sessions });
  }
}
