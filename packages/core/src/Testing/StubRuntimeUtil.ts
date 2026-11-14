import type { RunKind } from "@antigravity-connector/protocol";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";

export type StubRunRequest = {
  prompt: string;
  modelSlug: string;
};

export type StubUsage = {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
};

export type StubOutputFileNameToBytes = Record<string, Uint8Array>;

export type RunKindToLimit = Partial<Record<RunKind, number>>;

export type StubRunResult = {
  envelope: {
    conversation_id: string;
    status: "SUCCESS";
    response: string;
    duration_seconds: number;
    num_turns: number;
    usage: StubUsage;
  };
  outputFiles: StubOutputFileNameToBytes;
};

export type StubSessionKind = "connected" | "login_required";

export type StubConnectedCheck = { kind: "connected" };

export type StubLoginRequiredCheck = {
  kind: "login_required";
  loginUrl: string;
};

export type StubCheckResult = StubConnectedCheck | StubLoginRequiredCheck;

export type StubRunOptions = {
  answer?: string;
  respond?: (request: StubRunRequest) => Promise<StubRunResult>;
  sessionKind?: StubSessionKind;
  limits?: RunKindToLimit;
  maxWaitMs?: number;
};

export type StubRuntime = {
  runService: AgyRunService;
  requests: StubRunRequest[];
};

export class StubRuntimeUtil {
  static readonly DEFAULT_ANSWER = "Node.js 26 is the current LTS. See https://nodejs.org/en/about/previous-releases.";

  static readonly DEFAULT_LIMIT = 200;

  static readonly MAX_WAIT_MS = 60000;

  static readonly RECHECK_MS = 30000;

  static readonly LOGIN_URL = "https://accounts.google.com/o/oauth2/EXAMPLE";

  static readonly SESSION_KIND_TO_CHECK: Readonly<Record<StubSessionKind, StubCheckResult>> = {
    connected: { kind: "connected" },
    login_required: { kind: "login_required", loginUrl: StubRuntimeUtil.LOGIN_URL },
  };

  static readonly USAGE: StubUsage = {
    input_tokens: 10,
    output_tokens: 5,
    thinking_tokens: 3,
    cache_read_tokens: 2,
    total_tokens: 18,
  };

  static buildResult(response: string): StubRunResult {
    return {
      envelope: {
        response,
        conversation_id: "00000000-0000-4000-8000-000000000000",
        status: "SUCCESS",
        duration_seconds: 20,
        num_turns: 1,
        usage: StubRuntimeUtil.USAGE,
      },
      outputFiles: {},
    };
  }

  static build(options: StubRunOptions = {}): StubRuntime {
    const requests: StubRunRequest[] = [];
    const answer = options.answer ?? StubRuntimeUtil.DEFAULT_ANSWER;
    const respond = options.respond ?? (() => Promise.resolve(StubRuntimeUtil.buildResult(answer)));
    const runner = {
      run: async (request: StubRunRequest): Promise<StubRunResult> => {
        requests.push({ prompt: request.prompt, modelSlug: request.modelSlug });
        return respond({ prompt: request.prompt, modelSlug: request.modelSlug });
      },
      stream: (): AsyncIterable<never> => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }),
      }),
    };
    const sessionKind = options.sessionKind ?? "connected";
    const checkPort = { check: () => Promise.resolve(StubRuntimeUtil.SESSION_KIND_TO_CHECK[sessionKind]) };
    const session = new AgySessionService({
      checkPort,
      minRecheckIntervalMs: StubRuntimeUtil.RECHECK_MS,
      clock: () => 0,
      logSink: () => undefined,
      secrets: [],
    });
    const runService = new AgyRunService({
      runner,
      session,
      queue: new QueueService({ maxWaitMs: options.maxWaitMs ?? StubRuntimeUtil.MAX_WAIT_MS }),
      limits: new DailyLimitService({
        runKindToLimit: StubRuntimeUtil.buildLimits(options.limits ?? {}),
        clock: () => new Date(0),
      }),
      baseTimeoutMs: StubRuntimeUtil.MAX_WAIT_MS,
      clock: () => 0,
      logSink: () => undefined,
      secrets: [],
    });
    return { runService, requests };
  }

  static buildLimits(overrides: RunKindToLimit): Record<RunKind, number> {
    return {
      chat: overrides.chat ?? StubRuntimeUtil.DEFAULT_LIMIT,
      search: overrides.search ?? StubRuntimeUtil.DEFAULT_LIMIT,
      research: overrides.research ?? StubRuntimeUtil.DEFAULT_LIMIT,
      image: overrides.image ?? StubRuntimeUtil.DEFAULT_LIMIT,
      browse: overrides.browse ?? StubRuntimeUtil.DEFAULT_LIMIT,
    };
  }
}
