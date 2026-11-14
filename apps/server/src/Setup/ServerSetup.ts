import type { FastifyInstance } from "fastify";
import {
  EnvUtil,
  LogUtil,
  RuntimeSetup,
  type CoreRuntime,
  type Env,
  type EnvNameToValue,
  type LogSink,
} from "@antigravity-connector/core";
import { ApiSetup } from "@antigravity-connector/api";
import { McpSetup } from "@antigravity-connector/mcp";
import type { RoutePlugin } from "@antigravity-connector/server/Protocols/RoutePluginProtocol.ts";
import { AppSetup } from "@antigravity-connector/server/Setup/AppSetup.ts";
import { NetworkBindUtil } from "@antigravity-connector/server/Utils/NetworkBindUtil.ts";

export type ServerSetupOptions = {
  env: Env;
  parentEnv: EnvNameToValue;
  logSink: LogSink;
  clock: () => number;
  createRoutePlugins: (runtime: CoreRuntime) => readonly RoutePlugin[];
};

export type RunningServer = {
  app: FastifyInstance;
  runtime: CoreRuntime;
};

export class ServerSetup {
  static readonly SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

  static readonly SHUTDOWN_GRACE_MS = 10000;

  static readonly LISTENING_EVENT = "server_listening";

  static async run(): Promise<void> {
    const parentEnv = EnvUtil.readProcessEnv();
    const env = EnvUtil.load(parentEnv);
    const server = await ServerSetup.start({
      env,
      parentEnv,
      logSink: (line: string) => {
        process.stdout.write(`${line}\n`);
      },
      clock: Date.now,
      createRoutePlugins: (runtime) => ServerSetup.buildDoors(runtime, env, Date.now),
    });
    for (const signal of ServerSetup.SHUTDOWN_SIGNALS) {
      process.once(signal, () => {
        void ServerSetup.stopServer(server, ServerSetup.SHUTDOWN_GRACE_MS).then(() => {
          process.exit(0);
        });
      });
    }
  }

  static buildDoors(runtime: CoreRuntime, env: Env, clock: () => number): readonly RoutePlugin[] {
    return [
      (app) => {
        ApiSetup.register(app, { runService: runtime.runService, clock });
      },
      (app) => {
        McpSetup.register(app, {
          clock,
          runService: runtime.runService,
          sessionTtlMs: env.MCP_SESSION_TTL_MS,
          maxSessions: env.MCP_MAX_SESSIONS,
          researchDailyLimit: env.DAILY_LIMIT_RESEARCH,
        });
      },
    ];
  }

  static async build(options: ServerSetupOptions): Promise<RunningServer> {
    const runtime = RuntimeSetup.build({
      env: options.env,
      parentEnv: options.parentEnv,
      logSink: options.logSink,
      clock: options.clock,
    });
    const app = await AppSetup.build({
      apiKey: options.env.API_KEY,
      maxRequestsPerMinute: options.env.HTTP_MAX_REQUESTS_PER_MINUTE,
      clock: options.clock,
      readSessionKind: () => runtime.sessionService.getStatus().kind,
      routePlugins: options.createRoutePlugins(runtime),
    });
    return { app, runtime };
  }

  static async start(options: ServerSetupOptions): Promise<RunningServer> {
    NetworkBindUtil.assertBindAllowed(options.env.HOST, options.env.ALLOW_NON_LOOPBACK_BIND);
    const server = await ServerSetup.build(options);
    await server.app.listen({ host: options.env.HOST, port: options.env.PORT });
    LogUtil.write(
      {
        level: "info",
        event: ServerSetup.LISTENING_EVENT,
        metadata: { host: options.env.HOST, port: options.env.PORT },
      },
      { now: new Date(options.clock()), secrets: [options.env.API_KEY], sink: options.logSink },
    );
    void server.runtime.checkSession();
    return server;
  }

  static async stopServer(server: RunningServer, graceMs: number): Promise<void> {
    const killTimer = setTimeout(() => {
      server.runtime.stopRunningCalls();
    }, graceMs);
    try {
      await server.app.close();
    } finally {
      clearTimeout(killTimer);
      server.runtime.stopRunningCalls();
    }
  }
}
