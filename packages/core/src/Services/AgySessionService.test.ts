import { describe, expect, it } from "vitest";
import type { AgySessionCheckPort, AgySessionCheckResult } from "@antigravity-connector/agy";
import { AgySessionRequiredError } from "@antigravity-connector/agy";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { AgyUnavailableError } from "@antigravity-connector/core/Errors/AgyUnavailableError.ts";

const LOGIN_URL = "https://accounts.google.com/o/oauth2/EXAMPLE";
const RECHECK_MS = 30000;

type ScriptedCheck = {
  port: AgySessionCheckPort;
  setNext: (result: AgySessionCheckResult) => void;
  calls: () => number;
};

const buildScriptedCheck = (initial: AgySessionCheckResult): ScriptedCheck => {
  let next = initial;
  let count = 0;
  return {
    port: {
      check: () => {
        count += 1;
        return Promise.resolve(next);
      },
    },
    setNext: (result) => {
      next = result;
    },
    calls: () => count,
  };
};

const createService = (check: ScriptedCheck, clock: { now: number }, lines: string[]): AgySessionService =>
  new AgySessionService({
    checkPort: check.port,
    clock: () => clock.now,
    minRecheckIntervalMs: RECHECK_MS,
    logSink: (line) => lines.push(line),
    secrets: [],
  });

describe("AgySessionService", () => {
  it("logs one block with the login URL and the docker exec command when login is required at startup", async () => {
    const lines: string[] = [];
    const check = buildScriptedCheck({ kind: "login_required", loginUrl: LOGIN_URL });
    const service = createService(check, { now: 0 }, lines);

    await service.check();
    const loginLines = lines.filter((line) => line.includes(LOGIN_URL));

    expect(loginLines).toHaveLength(1);
    expect(loginLines[0]).toContain("docker exec -it antigravity-connector agy");
  });

  it("moves from connected to login_required when a run reports the session is missing", async () => {
    const lines: string[] = [];
    const check = buildScriptedCheck({ kind: "connected" });
    const service = createService(check, { now: 0 }, lines);
    await service.check();

    service.reportSessionRequired(LOGIN_URL);

    expect(service.getStatus()).toStrictEqual({ kind: "login_required", loginUrl: LOGIN_URL });
  });

  it("refuses without checking again before the minimum interval has passed", async () => {
    const lines: string[] = [];
    const check = buildScriptedCheck({ kind: "login_required", loginUrl: LOGIN_URL });
    const clock = { now: 0 };
    const service = createService(check, clock, lines);
    await service.check();

    clock.now = RECHECK_MS - 1;
    const attempt = service.ensureConnected();

    await expect(attempt).rejects.toBeInstanceOf(AgySessionRequiredError);
    expect(check.calls()).toBe(1);
  });

  it("becomes connected at the next re-check after the owner logs in, without a restart", async () => {
    const lines: string[] = [];
    const check = buildScriptedCheck({ kind: "login_required", loginUrl: LOGIN_URL });
    const clock = { now: 0 };
    const service = createService(check, clock, lines);
    await service.check();

    check.setNext({ kind: "connected" });
    clock.now = RECHECK_MS;
    await service.ensureConnected();

    expect(service.getStatus()).toStrictEqual({ kind: "connected" });
  });

  it("refuses with AgyUnavailableError when the binary is unavailable", async () => {
    const lines: string[] = [];
    const check = buildScriptedCheck({ kind: "unavailable", reason: "agy binary not found" });
    const service = createService(check, { now: 0 }, lines);
    await service.check();

    await expect(service.ensureConnected()).rejects.toBeInstanceOf(AgyUnavailableError);
  });
});
