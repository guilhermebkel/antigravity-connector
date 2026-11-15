import type { FastifyInstance } from "fastify";
import { ImageRunService, type AgyLoginService, type AgyRunService } from "@antigravity-connector/core";
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
      toolJobs: new ToolJobService({ clock: options.clock, waitMs: options.jobWaitMs }),
      researchDailyLimit: options.researchDailyLimit,
      loginService: options.loginService,
    };
    McpRoute.register(app, { services, sessions });
  }
}
