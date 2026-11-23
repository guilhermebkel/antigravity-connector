import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EnvUtil, type Env } from "@antigravity-connector/core";
import { ServerSetup, type RunningServer } from "@antigravity-connector/server/Setup/ServerSetup.ts";

export const SERVER_API_KEY = "test-api-key-0123456789abcdef";

export type StartedServer = {
  server: RunningServer;
  address: string;
};

export class ServerHarnessUtil {
  static readonly FAKE_AGY = resolve(import.meta.dirname, "../../../../packages/agy/src/Testing/FakeAgy.mjs");

  static readonly RUN_TIMEOUT_MS = 60000;

  static readonly OUTPUT_WAIT_MS = 300;

  static readonly SHUTDOWN_GRACE_MS = 2000;

  static buildDataDirectory(): string {
    const prefix = join(tmpdir(), "acon-data-");
    return mkdtempSync(prefix);
  }

  static buildEnv(overrides: Record<string, string> = {}): Env {
    return EnvUtil.load({
      API_KEY: SERVER_API_KEY,
      AGY_BIN: ServerHarnessUtil.FAKE_AGY,
      AGY_TIMEOUT_MS: String(ServerHarnessUtil.RUN_TIMEOUT_MS),
      AGY_OUTPUT_WAIT_MS: String(ServerHarnessUtil.OUTPUT_WAIT_MS),
      DATA_DIR: ServerHarnessUtil.buildDataDirectory(),
      ...overrides,
    });
  }

  static async start(env: Env): Promise<StartedServer> {
    const server = await ServerSetup.build({
      env,
      parentEnv: { API_KEY: SERVER_API_KEY, PATH: EnvUtil.readProcessEnv().PATH ?? "" },
      logSink: () => undefined,
      clock: Date.now,
      createRoutePlugins: (runtime) => ServerSetup.buildDoors(runtime, env, Date.now),
    });
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    return { server, address };
  }

  static async stop(started: StartedServer): Promise<void> {
    await ServerSetup.stopServer(started.server, ServerHarnessUtil.SHUTDOWN_GRACE_MS);
  }
}
