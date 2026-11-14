import type { FastifyInstance } from "fastify";
import type { AgyRunService } from "@antigravity-connector/core";
import { McpSessionService } from "@antigravity-connector/mcp/Services/McpSessionService.ts";
import { McpRoute } from "@antigravity-connector/mcp/Routes/McpRoute.ts";

export type McpSetupOptions = {
  runService: AgyRunService;
  clock: () => number;
  sessionTtlMs: number;
  maxSessions: number;
};

export class McpSetup {
  static register(app: FastifyInstance, options: McpSetupOptions): void {
    const sessions = new McpSessionService({
      ttlMs: options.sessionTtlMs,
      maxSessions: options.maxSessions,
      clock: options.clock,
    });
    McpRoute.register(app, { runService: options.runService, sessions });
  }
}
