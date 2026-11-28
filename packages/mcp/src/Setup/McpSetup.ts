import type { FastifyInstance } from "fastify";
import {
  HttpsImageDownloadAdapter,
  ImageQuotaService,
  ImageRunService,
  ImageSourceService,
  MediaUploadService,
  MediaRunService,
  type AgyLoginService,
  type AgyRunService,
  type AgyUsageService,
  type RemoteImageDownloadPort,
} from "@antigravity-connector/core";
import { McpSessionService } from "@antigravity-connector/mcp/Services/McpSessionService.ts";
import { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";
import { McpRoute } from "@antigravity-connector/mcp/Routes/McpRoute.ts";
import { UploadRoute } from "@antigravity-connector/mcp/Routes/UploadRoute.ts";

export type McpSetupOptions = {
  runService: AgyRunService;
  clock: () => number;
  sessionTtlMs: number;
  maxSessions: number;
  researchDailyLimit: number;
  loginService: AgyLoginService;
  imageService?: ImageRunService;
  usageService: AgyUsageService;
  jobWaitMs?: number;
  imageDownloader?: RemoteImageDownloadPort;
  publicUrl?: string | undefined;
};

export class McpSetup {
  static register(app: FastifyInstance, options: McpSetupOptions): void {
    const sessions = new McpSessionService({
      ttlMs: options.sessionTtlMs,
      maxSessions: options.maxSessions,
      clock: options.clock,
    });
    const mediaUploadService = new MediaUploadService({ clock: options.clock });
    const services = {
      mediaUploadService,
      mediaService: new MediaRunService({ runService: options.runService, uploads: mediaUploadService }),
      publicUrl: options.publicUrl,
      runService: options.runService,
      imageService: options.imageService ?? new ImageRunService({
        runService: options.runService,
        quota: new ImageQuotaService({ clock: options.clock }),
      }),
      imageSourceService: new ImageSourceService({
        downloader: options.imageDownloader ?? new HttpsImageDownloadAdapter(),
        uploads: mediaUploadService,
      }),
      toolJobs: new ToolJobService({ clock: options.clock, waitMs: options.jobWaitMs }),
      researchDailyLimit: options.researchDailyLimit,
      loginService: options.loginService,
      usageService: options.usageService,
    };
    McpRoute.register(app, { services, sessions });
    UploadRoute.register(app, { uploads: mediaUploadService });
  }
}
