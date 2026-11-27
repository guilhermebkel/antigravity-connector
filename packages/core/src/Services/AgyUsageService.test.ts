import { describe, expect, it } from "vitest";
import { AgySessionRequiredError, type AgyUsagePort } from "@antigravity-connector/agy";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { AgyUsageService } from "@antigravity-connector/core/Services/AgyUsageService.ts";
import { StubUsageUtil } from "@antigravity-connector/core/Testing/StubUsageUtil.ts";

const LOGIN_URL = "https://accounts.google.com/o/oauth2/EXAMPLE";

const buildService = (port: AgyUsagePort = StubUsageUtil.buildPort()) => {
  const clock = { now: 0 };
  const session = new AgySessionService({
    checkPort: { check: () => Promise.resolve({ kind: "connected" as const }) },
    clock: () => clock.now,
    minRecheckIntervalMs: 30000,
    logSink: () => undefined,
    secrets: [],
  });
  return { clock, session, service: new AgyUsageService({ port, session, clock: () => clock.now }) };
};

describe("AgyUsageService", () => {
  it("reads the report and stamps the time", async () => {
    const { clock, service } = buildService();
    clock.now = 5000;
    const snapshot = await service.read();
    expect(snapshot.checkedAtMs).toBe(5000);
    expect(snapshot.report).toStrictEqual(StubUsageUtil.REPORT);
  });

  it("answers from the cache for 30 seconds, then asks agy again", async () => {
    const port = StubUsageUtil.buildPort();
    const { clock, service } = buildService(port);
    await service.read();
    clock.now = 29999;
    await service.read();
    expect(port.reads).toBe(1);
    clock.now = 30000;
    await service.read();
    expect(port.reads).toBe(2);
  });

  it("shares one read between calls that arrive together", async () => {
    const port = StubUsageUtil.buildPort();
    const { service } = buildService(port);
    await Promise.all([service.read(), service.read(), service.read()]);
    expect(port.reads).toBe(1);
  });

  it("moves the session to login_required when agy asks to log in, and does not cache the failure", async () => {
    let shouldFail = true;
    const port: AgyUsagePort = {
      read: () => (shouldFail
        ? Promise.reject(new AgySessionRequiredError(LOGIN_URL))
        : StubUsageUtil.buildPort().read()),
    };
    const { session, service } = buildService(port);
    await session.check();
    await expect(service.read()).rejects.toBeInstanceOf(AgySessionRequiredError);
    expect(session.getStatus()).toStrictEqual({ kind: "login_required", loginUrl: LOGIN_URL });
    shouldFail = false;
  });
});
