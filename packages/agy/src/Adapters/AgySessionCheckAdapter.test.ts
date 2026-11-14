import { chmodSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyCliAdapter } from "@antigravity-connector/agy/Adapters/AgyCliAdapter.ts";
import { AgySessionCheckAdapter } from "@antigravity-connector/agy/Adapters/AgySessionCheckAdapter.ts";

const FAKE_BINARY = resolve(import.meta.dirname, "../Testing/FakeAgy.mjs");
const MODEL_SLUG = "gemini-3.8-flash-low";
const CHECK_TIMEOUT_MS = 300;
const LONG_TIMEOUT_MS = 20000;

let tempRoot = "";

const buildRunner = (binaryPath: string = FAKE_BINARY): AgyCliAdapter =>
  new AgyCliAdapter({
    binaryPath,
    tempRoot,
    parentEnv: {
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      HOME: tempRoot,
      LANG: "C.UTF-8",
    },
  });

const buildCheck = (prompt: string, timeoutMs: number, binaryPath?: string): AgySessionCheckAdapter =>
  new AgySessionCheckAdapter({ runner: buildRunner(binaryPath), modelSlug: MODEL_SLUG, timeoutMs, prompt });

beforeEach(() => {
  const prefix = join(tmpdir(), "agy-session-check-test-");
  tempRoot = mkdtempSync(prefix);
  chmodSync(FAKE_BINARY, 0o755);
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("AgySessionCheckAdapter.check", () => {
  it("returns connected when the fake answers the ping", async () => {
    const result = await buildCheck("[[fake-agy:success]] ping", LONG_TIMEOUT_MS).check();

    expect(result).toStrictEqual({ kind: "connected" });
  });

  it("returns login_required with the URL from the no-session fixture", async () => {
    const result = await buildCheck("[[fake-agy:no-session]] ping", LONG_TIMEOUT_MS).check();

    expect(result).toStrictEqual({
      kind: "login_required",
      loginUrl: "https://accounts.google.com/o/oauth2/EXAMPLE",
    });
  });

  it("returns unavailable naming the path when the binary does not exist", async () => {
    const missingPath = join(tempRoot, "no-such-agy");

    const result = await buildCheck("ping", LONG_TIMEOUT_MS, missingPath).check();

    expect(result).toStrictEqual({
      kind: "unavailable",
      reason: `agy binary not found: spawn ${missingPath} ENOENT`,
    });
  });

  it("returns unavailable when the login URL is on another host", async () => {
    const result = await buildCheck("[[fake-agy:no-session-other-host]] ping", LONG_TIMEOUT_MS).check();

    expect(result).toStrictEqual({
      kind: "unavailable",
      reason: "agy asked to log in without a login URL on the expected host",
    });
  });

  it("returns unavailable after the timeout and leaves no directory or process behind", async () => {
    const result = await buildCheck("[[fake-agy:slow]] ping", CHECK_TIMEOUT_MS).check();
    const remaining = readdirSync(tempRoot);

    expect(result).toStrictEqual({ kind: "unavailable", reason: `agy did not answer within ${CHECK_TIMEOUT_MS} ms` });
    expect(remaining).toStrictEqual([]);
  });
});
