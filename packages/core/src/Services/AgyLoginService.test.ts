import { describe, expect, it } from "vitest";
import { AuthAttemptMissingError } from "@antigravity-connector/core/Errors/AuthAttemptMissingError.ts";
import { AuthCodeRejectedError } from "@antigravity-connector/core/Errors/AuthCodeRejectedError.ts";
import { StubLoginPort } from "@antigravity-connector/core/Testing/StubLoginPort.ts";
import { StubRuntimeUtil } from "@antigravity-connector/core/Testing/StubRuntimeUtil.ts";

const LOGIN_WINDOW_SECONDS = 60;

describe("AgyLoginService", () => {
  it("readStatus returns connected without starting a login when agy is logged in", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "connected" });
    const status = await stub.loginService.readStatus();

    expect(status).toStrictEqual({ kind: "connected" });
  });

  it("readStatus starts a login when the check cannot tell (a pipe run prints no link), and returns the link", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "unavailable" });
    const status = await stub.loginService.readStatus();

    expect(status).toStrictEqual({
      kind: "login_required",
      loginUrl: StubLoginPort.LOGIN_URL,
      expiresInSeconds: LOGIN_WINDOW_SECONDS,
    });
  });

  it("readStatus returns the login link and its lifetime when login is required", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "login_required" });
    const status = await stub.loginService.readStatus();

    expect(status).toStrictEqual({
      kind: "login_required",
      loginUrl: StubLoginPort.LOGIN_URL,
      expiresInSeconds: LOGIN_WINDOW_SECONDS,
    });
  });

  it("submitCode without a started login is refused", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "login_required" });

    await expect(stub.loginService.submitCode(StubLoginPort.GOOD_CODE)).rejects.toThrow(AuthAttemptMissingError);
  });

  it("a wrong code is refused with a clear error", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "login_required" });
    await stub.loginService.readStatus();

    await expect(stub.loginService.submitCode("wrong")).rejects.toThrow(AuthCodeRejectedError);
  });

  it("the right code connects agy, and readStatus then reports connected", async () => {
    const stub = StubRuntimeUtil.build({ sessionKind: "login_required" });
    await stub.loginService.readStatus();
    const connected = await stub.loginService.submitCode(StubLoginPort.GOOD_CODE);
    const later = await stub.loginService.readStatus();

    expect(connected).toStrictEqual({ kind: "connected" });
    expect(later).toStrictEqual({ kind: "connected" });
  });
});
