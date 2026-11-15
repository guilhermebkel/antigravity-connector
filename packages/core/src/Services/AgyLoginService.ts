import type { AgyLoginBeginResult, AgyLoginPort, AgyLoginSubmitResult } from "@antigravity-connector/agy";
import type { LogContext, LogSink } from "@antigravity-connector/core/Protocols/LogProtocol.ts";
import type { AuthStatus } from "@antigravity-connector/core/Protocols/AuthStatusProtocol.ts";
import type { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import type { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { AuthAttemptMissingError } from "@antigravity-connector/core/Errors/AuthAttemptMissingError.ts";
import { AuthCodeRejectedError } from "@antigravity-connector/core/Errors/AuthCodeRejectedError.ts";
import { LogUtil } from "@antigravity-connector/core/Utils/LogUtil.ts";

export type AgyLoginServiceOptions = {
  loginPort: AgyLoginPort;
  sessionService: AgySessionService;
  queue: QueueService;
  clock: () => number;
  logSink: LogSink;
  secrets: readonly string[];
};

export class AgyLoginService {
  static readonly LOGIN_WINDOW_SECONDS = 60;

  static readonly LOGIN_STARTED_EVENT = "agy_login_started";

  static readonly LOGIN_SUBMITTED_EVENT = "agy_login_submitted";

  static readonly UNKNOWN_REASON = "unknown";

  static readonly SUBMIT_RESULT_TO_ERROR: Partial<Record<AgyLoginSubmitResult["kind"], () => Error>> = {
    no_attempt: () => new AuthAttemptMissingError(),
    rejected: () => new AuthCodeRejectedError(),
  };

  private readonly loginPort: AgyLoginPort;

  private readonly sessionService: AgySessionService;

  private readonly queue: QueueService;

  private readonly clock: () => number;

  private readonly logSink: LogSink;

  private readonly secrets: readonly string[];

  constructor(options: AgyLoginServiceOptions) {
    this.loginPort = options.loginPort;
    this.sessionService = options.sessionService;
    this.queue = options.queue;
    this.clock = options.clock;
    this.logSink = options.logSink;
    this.secrets = options.secrets;
  }

  async readStatus(): Promise<AuthStatus> {
    const begun = await this.loginPort.start();
    if (begun.kind !== "connected") {
      return this.buildUnconnected(begun);
    }
    return this.checkConnected();
  }

  async submitCode(code: string): Promise<AuthStatus> {
    const result = await this.loginPort.submit(code);
    this.log(AgyLoginService.LOGIN_SUBMITTED_EVENT, result.kind);
    AgyLoginService.throwIfRefused(result);
    return this.checkConnected();
  }

  buildUnconnected(begun: AgyLoginBeginResult): AuthStatus {
    if (begun.loginUrl === undefined) {
      return { kind: "unavailable", reason: begun.reason ?? AgyLoginService.UNKNOWN_REASON };
    }
    this.sessionService.reportSessionRequired(begun.loginUrl);
    this.log(AgyLoginService.LOGIN_STARTED_EVENT, "started");
    return {
      kind: "login_required",
      loginUrl: begun.loginUrl,
      expiresInSeconds: AgyLoginService.LOGIN_WINDOW_SECONDS,
    };
  }

  async checkConnected(): Promise<AuthStatus> {
    const status = await this.queue.run(() => this.sessionService.check());
    if (status.kind === "connected") {
      return { kind: "connected" };
    }
    return { kind: "unavailable", reason: status.reason ?? AgyLoginService.UNKNOWN_REASON };
  }

  static throwIfRefused(result: AgyLoginSubmitResult): void {
    const buildError = AgyLoginService.SUBMIT_RESULT_TO_ERROR[result.kind];
    if (buildError !== undefined) {
      throw buildError();
    }
  }

  private log(event: string, result: string): void {
    const context: LogContext = { now: new Date(this.clock()), sink: this.logSink, secrets: this.secrets };
    LogUtil.write({ event, level: "info", metadata: { result } }, context);
  }
}
