import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { env as inheritedEnv } from "node:process";
import { fileURLToPath } from "node:url";

// Why: the harness starts the built bundle as a real process and passes only the env keys listed here (process.env is read in EnvUtil only).
export const FAKE_AGY_PATH = fileURLToPath(new URL("../../packages/agy/src/Testing/FakeAgy.mjs", import.meta.url));
export const DEFAULT_ENTRY = fileURLToPath(new URL("../../apps/server/dist/main.mjs", import.meta.url));
export const API_KEY = "e2e-api-key-0123456789abcdef";
const LOOPBACK_HOST = "127.0.0.1";
const HEALTH_POLL_MS = 100;
const HEALTH_TIMEOUT_MS = 15000;
const STOP_TIMEOUT_MS = 5000;
const running = new Set();

export const findFreePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.on("error", reject);
  probe.listen(0, LOOPBACK_HOST, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const readExit = (child) => new Promise((resolve) => {
  child.once("exit", (code) => resolve(code));
});

const waitForHealth = async (baseUrl, child, readStderr) => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`the server exited with code ${child.exitCode} before /health answered:\n${readStderr()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Why: the server answers only after it has started; a connection error means it is not up yet.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, HEALTH_POLL_MS);
    });
  }
  throw new Error(`the server did not answer /health in time:\n${readStderr()}`);
};

const stopProcess = async (child, exited) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    running.delete(child);
    return;
  }
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, STOP_TIMEOUT_MS);
  await exited;
  clearTimeout(timer);
  running.delete(child);
};

export const startServer = async ({ entry = DEFAULT_ENTRY, env = {} } = {}) => {
  if (!existsSync(entry)) {
    throw new Error(`The server bundle ${entry} does not exist. Run pnpm build first.`);
  }
  const port = Number(env.PORT ?? (await findFreePort()));
  const child = spawn(process.execPath, [entry], {
    env: {
      PATH: inheritedEnv.PATH ?? "",
      HOME: inheritedEnv.HOME ?? "",
      API_KEY,
      HOST: LOOPBACK_HOST,
      PORT: String(port),
      AGY_BIN: FAKE_AGY_PATH,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  running.add(child);
  const exited = readExit(child);
  const server = {
    child,
    port,
    baseUrl: `http://${LOOPBACK_HOST}:${port}`,
    readStderr: () => stderr,
    stop: () => stopProcess(child, exited),
  };
  try {
    await waitForHealth(server.baseUrl, child, () => stderr);
  } catch (error) {
    await server.stop();
    throw error;
  }
  return server;
};

export const stopAllServers = async () => {
  const children = [...running];
  await Promise.all(children.map((child) => stopProcess(child, readExit(child))));
};
