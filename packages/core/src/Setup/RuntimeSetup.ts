import { tmpdir } from "node:os";
import type { RunKind } from "@antigravity-connector/protocol";
import { AgyCliAdapter, AgySessionCheckAdapter } from "@antigravity-connector/agy";
import type { EnvNameToValue, Env } from "@antigravity-connector/core/Protocols/EnvProtocol.ts";
import type { LogSink } from "@antigravity-connector/core/Protocols/LogProtocol.ts";
import type { CoreRuntime } from "@antigravity-connector/core/Protocols/CoreRuntimeProtocol.ts";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { CallLogService } from "@antigravity-connector/core/Services/CallLogService.ts";
import { ModelNotFoundError } from "@antigravity-connector/core/Errors/ModelNotFoundError.ts";
import { ModelCatalogueUtil } from "@antigravity-connector/protocol";

export type RuntimeSetupOptions = {
  env: Env;
  parentEnv: EnvNameToValue;
  logSink: LogSink;
  clock: () => number;
};

export class RuntimeSetup {
  static readonly SESSION_RECHECK_INTERVAL_MS = 30000;

  static readonly SESSION_CHECK_MODEL_ID = "gemini-3.8-flash";

  static readonly SESSION_CHECK_EFFORT = "low";

  static build(options: RuntimeSetupOptions): CoreRuntime {
    const { env } = options;
    const adapter = new AgyCliAdapter({
      binaryPath: env.AGY_BIN,
      tempRoot: tmpdir(),
      parentEnv: options.parentEnv,
    });
    const sessionService = new AgySessionService({
      checkPort: RuntimeSetup.buildCheckAdapter(adapter, env),
      clock: options.clock,
      minRecheckIntervalMs: RuntimeSetup.SESSION_RECHECK_INTERVAL_MS,
      logSink: options.logSink,
      secrets: [env.API_KEY],
    });
    const queue = new QueueService({ maxWaitMs: env.QUEUE_MAX_WAIT_MS });
    const callLog = new CallLogService({ dataDirectory: env.DATA_DIR });
    const limits = RuntimeSetup.buildLimits(env, options.clock);
    RuntimeSetup.seedLimits(callLog, limits, new Date(options.clock()));
    const runService = new AgyRunService({
      queue,
      limits,
      callLog,
      runner: adapter,
      session: sessionService,
      baseTimeoutMs: env.AGY_TIMEOUT_MS,
      clock: options.clock,
      logSink: options.logSink,
      secrets: [env.API_KEY],
    });
    return {
      runService,
      sessionService,
      stopRunningCalls: () => {
        adapter.stopAll();
      },
      checkSession: async () => {
        await queue.run(() => sessionService.check());
      },
    };
  }

  static buildCheckAdapter(adapter: AgyCliAdapter, env: Env): AgySessionCheckAdapter {
    const modelSlug = ModelCatalogueUtil.resolveSlug(
      RuntimeSetup.SESSION_CHECK_MODEL_ID,
      RuntimeSetup.SESSION_CHECK_EFFORT,
    );
    if (modelSlug === undefined) {
      throw new ModelNotFoundError(RuntimeSetup.SESSION_CHECK_MODEL_ID);
    }
    return new AgySessionCheckAdapter({ modelSlug, runner: adapter, timeoutMs: env.AGY_TIMEOUT_MS });
  }

  static seedLimits(callLog: CallLogService, limits: DailyLimitService, now: Date): void {
    const retentionCutoffMs = now.getTime() - CallLogService.RETENTION_DAYS * CallLogService.MS_PER_DAY;
    callLog.removeBefore(new Date(retentionCutoffMs).toISOString());
    const startOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    limits.seed(callLog.countKindsSince(startOfDayIso));
  }

  static buildLimits(env: Env, clock: () => number): DailyLimitService {
    const runKindToLimit: Record<RunKind, number> = {
      chat: env.DAILY_LIMIT_CHAT,
      search: env.DAILY_LIMIT_SEARCH,
      research: env.DAILY_LIMIT_RESEARCH,
      image: env.DAILY_LIMIT_IMAGE,
      browse: env.DAILY_LIMIT_BROWSE,
    };
    return new DailyLimitService({ runKindToLimit, clock: () => new Date(clock()) });
  }
}
