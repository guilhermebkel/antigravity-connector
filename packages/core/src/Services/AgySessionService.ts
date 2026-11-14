import type { AgySessionCheckPort } from "@antigravity-connector/agy";
import { AgySessionRequiredError } from "@antigravity-connector/agy";
import type { LogContext, LogEntry, LogSink } from "@antigravity-connector/core/Protocols/LogProtocol.ts";
import type { AgySessionKind, AgySessionStatus } from "@antigravity-connector/core/Protocols/AgySessionStatusProtocol.ts";
import { AgyUnavailableError } from "@antigravity-connector/core/Errors/AgyUnavailableError.ts";
import { LogUtil } from "@antigravity-connector/core/Utils/LogUtil.ts";

export type AgySessionOptions = {
  checkPort: AgySessionCheckPort;
  clock: () => number;
  minRecheckIntervalMs: number;
  logSink: LogSink;
  secrets: readonly string[];
};

export class AgySessionService {
  static readonly LOGIN_COMMAND = "docker exec -it antigravity-connector agy";

  static readonly LOGIN_MESSAGE = "agy is not logged in: open loginUrl in a browser, then enter the code with command";

  static readonly UNKNOWN_REASON = "unknown";

  static readonly KIND_TO_REFUSAL: Readonly<Record<AgySessionKind, (status: AgySessionStatus) => Error>> = {
    login_required: (status) => new AgySessionRequiredError(status.loginUrl),
    unavailable: (status) => new AgyUnavailableError(status.reason ?? AgySessionService.UNKNOWN_REASON),
    connected: () => new AgyUnavailableError("the session has not been checked yet"),
    unchecked: () => new AgyUnavailableError("the session has not been checked yet"),
  };

  static readonly KIND_TO_LOG_ENTRY: Readonly<Record<AgySessionKind, (status: AgySessionStatus) => LogEntry>> = {
    login_required: (status) => ({
      level: "warn",
      event: "agy_login_required",
      metadata: {
        loginUrl: status.loginUrl ?? "",
        command: AgySessionService.LOGIN_COMMAND,
        message: AgySessionService.LOGIN_MESSAGE,
      },
    }),
    unavailable: (status) => ({
      level: "warn",
      event: "agy_unavailable",
      metadata: { reason: status.reason ?? AgySessionService.UNKNOWN_REASON },
    }),
    connected: () => ({ level: "info", event: "agy_connected", metadata: {} }),
    unchecked: () => ({ level: "info", event: "agy_unchecked", metadata: {} }),
  };

  private readonly checkPort: AgySessionCheckPort;

  private readonly clock: () => number;

  private readonly minRecheckIntervalMs: number;

  private readonly logSink: LogSink;

  private readonly secrets: readonly string[];

  private status: AgySessionStatus = { kind: "unchecked" };

  private lastCheckAtMs: number | undefined = undefined;

  constructor(options: AgySessionOptions) {
    this.checkPort = options.checkPort;
    this.clock = options.clock;
    this.minRecheckIntervalMs = options.minRecheckIntervalMs;
    this.logSink = options.logSink;
    this.secrets = options.secrets;
  }

  getStatus(): AgySessionStatus {
    return this.status;
  }

  async check(): Promise<AgySessionStatus> {
    const result = await this.checkPort.check();
    this.lastCheckAtMs = this.clock();
    this.applyStatus(result);
    return this.status;
  }

  async ensureConnected(): Promise<void> {
    if (this.isConnected()) {
      return;
    }
    if (this.canRecheck()) {
      await this.check();
    }
    if (this.isConnected()) {
      return;
    }
    throw AgySessionService.KIND_TO_REFUSAL[this.status.kind](this.status);
  }

  reportSessionRequired(loginUrl: string | undefined): void {
    if (loginUrl === undefined) {
      this.applyStatus({ kind: "unavailable", reason: "agy asked to log in without a login URL" });
      return;
    }
    this.applyStatus({ kind: "login_required", loginUrl });
  }

  private isConnected(): boolean {
    return this.status.kind === "connected";
  }

  private canRecheck(): boolean {
    if (this.lastCheckAtMs === undefined) {
      return true;
    }
    return this.clock() - this.lastCheckAtMs >= this.minRecheckIntervalMs;
  }

  private applyStatus(status: AgySessionStatus): void {
    this.status = status;
    const entry = AgySessionService.KIND_TO_LOG_ENTRY[status.kind](status);
    LogUtil.write(entry, this.buildContext());
  }

  private buildContext(): LogContext {
    return { now: new Date(this.clock()), secrets: this.secrets, sink: this.logSink };
  }
}
