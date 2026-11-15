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
import { MountUtil } from "@antigravity-connector/server/Utils/MountUtil.ts";
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

  static readonly LISTENING_EVENT = "server.started";

  static readonly STOPPED_EVENT = "server.stopped";

  static readonly STORAGE_EVENT = "storage.checked";

  static async run(): Promise<void> {
    const parentEnv = EnvUtil.readProcessEnv();
    const env = EnvUtil.load(parentEnv);
    const logSink = (line: string): void => {
      process.stdout.write(`${line}\n`);
    };
    const server = await ServerSetup.start({
      env,
      parentEnv,
      logSink,
      clock: Date.now,
      createRoutePlugins: (runtime) => ServerSetup.buildDoors(runtime, env, Date.now),
    });
    for (const signal of ServerSetup.SHUTDOWN_SIGNALS) {
      process.once(signal, () => {
        LogUtil.write(
          { level: "info", event: ServerSetup.STOPPED_EVENT, metadata: { signal } },
          { now: new Date(Date.now()), secrets: [env.API_KEY], sink: logSink },
        );
        void ServerSetup.stopServer(server, ServerSetup.SHUTDOWN_GRACE_MS).then(() => {
          process.exit(0);
        });
      });
    }
  }

  static buildDoors(runtime: CoreRuntime, env: Env, clock: () => number): readonly RoutePlugin[] {
    return [
      (app) => {
        ApiSetup.register(app, { runService: runtime.runService, loginService: runtime.loginService, clock });
      },
      (app) => {
        McpSetup.register(app, {
          clock,
          runService: runtime.runService,
          sessionTtlMs: env.MCP_SESSION_TTL_MS,
          maxSessions: env.MCP_MAX_SESSIONS,
          researchDailyLimit: env.DAILY_LIMIT_RESEARCH,
          loginService: runtime.loginService,
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
    LogUtil.setMinLevel(options.env.LOG_LEVEL);
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
    ServerSetup.logStorage(options);
    void server.runtime.checkSession();
    return server;
  }

  static logStorage(options: ServerSetupOptions): void {
    const mountPoints = MountUtil.readProcessMountPoints();
    if (mountPoints === undefined) {
      return;
    }
    const home = options.parentEnv.HOME ?? "";
    const isLoginDirMounted = home !== "" && MountUtil.isMountedUnder(mountPoints, home);
    const isDataDirMounted = MountUtil.isMountedAt(mountPoints, options.env.DATA_DIR);
    const isPersistent = isLoginDirMounted && isDataDirMounted;
    LogUtil.write(
      {
        level: isPersistent ? "info" : "warn",
        event: ServerSetup.STORAGE_EVENT,
        metadata: { isLoginDirMounted, isDataDirMounted },
      },
      { now: new Date(options.clock()), secrets: [options.env.API_KEY], sink: options.logSink },
    );
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
