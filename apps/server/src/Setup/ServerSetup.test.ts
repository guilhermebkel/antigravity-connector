import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EnvUtil, type Env } from "@antigravity-connector/core";
import { ServerSetup } from "@antigravity-connector/server/Setup/ServerSetup.ts";

const API_KEY = "test-api-key-0123456789abcdef";
const FAKE_AGY = resolve(import.meta.dirname, "../../../../packages/agy/src/Testing/FakeAgy.mjs");
const SLOW_TOKEN = "fake-agy:slow";
const POLL_INTERVAL_MS = 50;
const POLL_ATTEMPTS = 100;
const SHUTDOWN_GRACE_MS = 2000;
const RUN_TIMEOUT_MS = 60000;
const PROC_DIRECTORY = "/proc";
const NUL_SEPARATOR = "\0";

const buildEnv = (overrideNameToValue: Record<string, string>): Env => EnvUtil.load({
  API_KEY,
  AGY_BIN: FAKE_AGY,
  AGY_TIMEOUT_MS: String(RUN_TIMEOUT_MS),
  ...overrideNameToValue,
});

const readCommandLine = (processId: string): string => {
  try {
    return readFileSync(`${PROC_DIRECTORY}/${processId}/cmdline`, "utf8");
  } catch {
    return "";
  }
};

const countSlowAgyProcesses = (): number => readdirSync(PROC_DIRECTORY)
  .filter((entry) => /^\d+$/.test(entry))
  .map((processId) => readCommandLine(processId).split(NUL_SEPARATOR).join(" "))
  .filter((commandLine) => commandLine.includes(SLOW_TOKEN))
  .length;

const waitUntilSlowAgy = async (isWanted: (count: number) => boolean, message: string): Promise<void> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (isWanted(countSlowAgyProcesses())) {
      return;
    }
    await new Promise<void>((resolveWait) => {
      setTimeout(resolveWait, POLL_INTERVAL_MS);
    });
  }
  throw new Error(message);
};

describe("ServerSetup", () => {
  it("AC5: a non-loopback HOST without the override fails before anything listens", async () => {
    const options = {
      env: buildEnv({ HOST: "0.0.0.0" }),
      parentEnv: { API_KEY, HOST: "0.0.0.0" },
      logSink: () => undefined,
      clock: Date.now,
      createRoutePlugins: () => [],
    };
    await expect(ServerSetup.start(options)).rejects.toThrow(/127\.0\.0\.1:8787:8787/);
  });

  it("AC8: SIGTERM during a run stops the agy child and the run ends", async () => {
    const server = await ServerSetup.build({
      env: buildEnv({}),
      parentEnv: { API_KEY, PATH: EnvUtil.readProcessEnv().PATH ?? "" },
      logSink: () => undefined,
      clock: Date.now,
      createRoutePlugins: (runtime) => [
        (instance) => {
          instance.post("/v1/slow", async () => {
            await runtime.runService.run("chat", {
              door: "api",
              model: "gemini-3.8-flash",
              messages: [{ role: "user", content: "[[fake-agy:slow]] private text" }],
            });
            return { ok: true };
          });
        },
      ],
    });
    const pending = server.app.inject({
      method: "POST",
      url: "/v1/slow",
      headers: { authorization: `Bearer ${API_KEY}` },
      payload: {},
    });
    await waitUntilSlowAgy((count) => count > 0, "the slow agy process did not start");
    await ServerSetup.stopServer(server, SHUTDOWN_GRACE_MS);
    const response = await pending;
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    await waitUntilSlowAgy((count) => count === 0, "an agy child was left behind after shutdown");
  });
});
