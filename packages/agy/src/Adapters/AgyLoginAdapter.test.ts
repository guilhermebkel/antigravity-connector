import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { env } from "node:process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyLoginAdapter } from "@antigravity-connector/agy/Adapters/AgyLoginAdapter.ts";

const FAKE_LOGIN = resolve(import.meta.dirname, "../Testing/FakeAgyLogin.mjs");
const GOOD_CODE = "FAKE-GOOD-CODE";
const LOGIN_TEST_TIMEOUT_MS = 60000;
const MARKER = "fake-login-done";

let home = "";

const buildAdapter = (): AgyLoginAdapter => new AgyLoginAdapter({
  binaryPath: FAKE_LOGIN,
  tempRoot: home,
  parentEnv: { HOME: home, PATH: env.PATH ?? "", LANG: "C.UTF-8" },
  modelSlug: "gemini-3.8-flash-low",
});

beforeEach(() => {
  const prefix = join(tmpdir(), "acon-login-home-");
  home = mkdtempSync(prefix);
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("AgyLoginAdapter", () => {
  it("begin returns the Google login link, and a second begin returns the same open attempt", async () => {
    const adapter = buildAdapter();
    const first = await adapter.start();
    const second = await adapter.start();
    adapter.stop();

    expect(first.kind).toBe("started");
    expect(first.loginUrl?.startsWith("https://accounts.google.com/")).toBe(true);
    expect(second.loginUrl).toBe(first.loginUrl);
  }, LOGIN_TEST_TIMEOUT_MS);

  it("a wrong code is refused, and the attempt is then closed", async () => {
    const adapter = buildAdapter();
    await adapter.start();
    const refused = await adapter.submit("not-the-code");
    const after = await adapter.submit("anything");

    expect(refused.kind).toBe("rejected");
    expect(after.kind).toBe("no_attempt");
    const markerPath = join(home, MARKER);
    expect(existsSync(markerPath)).toBe(false);
  }, LOGIN_TEST_TIMEOUT_MS);

  it("the right code connects: agy writes its own login state into HOME", async () => {
    const adapter = buildAdapter();
    await adapter.start();
    const connected = await adapter.submit(GOOD_CODE);

    expect(connected.kind).toBe("connected");
    const markerPath = join(home, MARKER);
    expect(existsSync(markerPath)).toBe(true);
  }, LOGIN_TEST_TIMEOUT_MS);

  it("quotes the binary path and arguments for the shell", () => {
    expect(AgyLoginAdapter.quote("it's")).toBe("'it'\\''s'");
    expect(AgyLoginAdapter.buildCommand("/bin/agy", ["-p", "ping"])).toBe("'/bin/agy' '-p' 'ping'");
  });
});
