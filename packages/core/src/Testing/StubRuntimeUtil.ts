import type { RunKind } from "@antigravity-connector/protocol";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { RecordingCallLog } from "@antigravity-connector/core/Testing/RecordingCallLog.ts";
import type { AgyRunRequest } from "@antigravity-connector/agy";
import { AgyLoginService } from "@antigravity-connector/core/Services/AgyLoginService.ts";
import { StubLoginPort } from "@antigravity-connector/core/Testing/StubLoginPort.ts";

export type StubRunRequest = {
  prompt: string;
  modelSlug: string;
  conversationId?: string;
  jsonSchema?: string;
  attachmentNames?: readonly string[];
  expectedOutputFileNames?: readonly string[];
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

export type StubSessionKind = "connected" | "login_required" | "unavailable";

export type StubConnectedCheck = { kind: "connected" };

export type StubLoginRequiredCheck = {
  kind: "login_required";
  loginUrl: string;
};

export type StubUnavailableCheck = {
  kind: "unavailable";
  reason: string;
};

export type StubCheckResult = StubConnectedCheck | StubLoginRequiredCheck | StubUnavailableCheck;

export type StubRunOptions = {
  answer?: string;
  failAfterDeltas?: number;
  respond?: (request: StubRunRequest) => Promise<StubRunResult>;
  sessionKind?: StubSessionKind;
  limits?: RunKindToLimit;
  maxWaitMs?: number;
};

export type StubStartedEvent = {
  kind: "started";
  conversationId: string;
};

export type StubTextEvent = {
  kind: "text";
  delta: string;
};

export type StubFinishedEvent = {
  kind: "finished";
  envelope: StubRunResult["envelope"];
};

export type StubStreamEvent = StubStartedEvent | StubTextEvent | StubFinishedEvent;

export type StubRuntime = {
  runService: AgyRunService;
  requests: StubRunRequest[];
  callLog: RecordingCallLog;
  loginService: AgyLoginService;
};

export class StubRuntimeUtil {
  static readonly DEFAULT_ANSWER = "Node.js 26 is the current LTS. See https://nodejs.org/en/about/previous-releases.";

  static readonly DEFAULT_LIMIT = 200;

  static readonly PIECE_PATTERN = /\S+\s*/g;

  static readonly MAX_WAIT_MS = 60000;

  static readonly RECHECK_MS = 30000;

  static readonly LOGIN_URL = "https://accounts.google.com/o/oauth2/EXAMPLE";

  static readonly SESSION_KIND_TO_CHECK: Readonly<Record<StubSessionKind, StubCheckResult>> = {
    connected: { kind: "connected" },
    login_required: { kind: "login_required", loginUrl: StubRuntimeUtil.LOGIN_URL },
    unavailable: { kind: "unavailable", reason: "agy did not answer the session check" },
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
    const callLog = new RecordingCallLog();
    const answer = options.answer ?? StubRuntimeUtil.DEFAULT_ANSWER;
    const respond = options.respond ?? (() => Promise.resolve(StubRuntimeUtil.buildResult(answer)));
    const answerOf = async (request: AgyRunRequest): Promise<StubRunResult> => {
      const record = StubRuntimeUtil.buildRecord(request);
      requests.push(record);
      return respond(record);
    };
    const runner = {
      run: (request: AgyRunRequest): Promise<StubRunResult> => answerOf(request),
      stream: (request: AgyRunRequest): AsyncIterable<StubStreamEvent> => StubRuntimeUtil.streamOf(
        answerOf(request),
        options.failAfterDeltas,
      ),
    };
    const sessionState: { kind: StubSessionKind } = { kind: options.sessionKind ?? "connected" };
    const checkPort = { check: () => Promise.resolve(StubRuntimeUtil.SESSION_KIND_TO_CHECK[sessionState.kind]) };
    const session = new AgySessionService({
      checkPort,
      minRecheckIntervalMs: StubRuntimeUtil.RECHECK_MS,
      clock: () => 0,
      logSink: () => undefined,
      secrets: [],
    });
    const queue = new QueueService({ maxWaitMs: options.maxWaitMs ?? StubRuntimeUtil.MAX_WAIT_MS, concurrency: 1 });
    const runService = new AgyRunService({
      runner,
      session,
      callLog,
      queue,
      limits: new DailyLimitService({
        runKindToLimit: StubRuntimeUtil.buildLimits(options.limits ?? {}),
        clock: () => new Date(0),
      }),
      baseTimeoutMs: StubRuntimeUtil.MAX_WAIT_MS,
      clock: () => 0,
      logSink: () => undefined,
      secrets: [],
    });
    const loginService = new AgyLoginService({
      queue,
      loginPort: new StubLoginPort(
        () => sessionState.kind === "connected",
        () => {
          sessionState.kind = "connected";
        },
      ),
      sessionService: session,
      clock: () => 0,
      logSink: () => undefined,
      secrets: [],
    });
    return { runService, requests, callLog, loginService };
  }

  static buildRecord(request: AgyRunRequest): StubRunRequest {
    return {
      prompt: request.prompt,
      modelSlug: request.modelSlug,
      conversationId: request.conversationId,
      jsonSchema: request.jsonSchema,
      attachmentNames: (request.attachments ?? []).map((attachment) => attachment.fileName),
      expectedOutputFileNames: request.profile.expectedOutputFileNames,
    };
  }

  static async* streamOf(
    answer: Promise<StubRunResult>,
    failAfterDeltas: number | undefined,
  ): AsyncGenerator<StubStreamEvent> {
    const result = await answer;
    const pieces = result.envelope.response.match(StubRuntimeUtil.PIECE_PATTERN) ?? [];
    yield { kind: "started", conversationId: result.envelope.conversation_id };
    for (const [index, piece] of pieces.entries()) {
      if (index === failAfterDeltas) {
        throw Object.assign(new Error("agy failed"), { code: "agy_failed" });
      }
      yield { kind: "text", delta: piece };
    }
    yield { kind: "finished", envelope: result.envelope };
  }

  static buildLimits(overrides: RunKindToLimit): Record<RunKind, number> {
    return {
      chat: overrides.chat ?? StubRuntimeUtil.DEFAULT_LIMIT,
      search: overrides.search ?? StubRuntimeUtil.DEFAULT_LIMIT,
      research: overrides.research ?? StubRuntimeUtil.DEFAULT_LIMIT,
      image: overrides.image ?? StubRuntimeUtil.DEFAULT_LIMIT,
      browse: overrides.browse ?? StubRuntimeUtil.DEFAULT_LIMIT,
      media: overrides.media ?? StubRuntimeUtil.DEFAULT_LIMIT,
    };
  }
}
