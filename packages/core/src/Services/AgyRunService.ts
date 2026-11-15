import { AsyncEventBufferService, ModelCatalogueUtil, type AgyUsage, type RunKind } from "@antigravity-connector/protocol";
import type { AgyRunRequest, AgyRunResult, AgyRunnerPort, AgyStreamOutputEvent } from "@antigravity-connector/agy";
import { AgyAbortedError, AgyFailedError, AgySessionRequiredError, AgyTimeoutError } from "@antigravity-connector/agy";
import type { RunInput } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { LogFieldToValue, LogSink } from "@antigravity-connector/core/Protocols/LogProtocol.ts";
import type { RunObserver, RunProgressEvent } from "@antigravity-connector/core/Protocols/RunProgressProtocol.ts";
import type { QueueHooks } from "@antigravity-connector/core/Protocols/QueueHooksProtocol.ts";
import type { CallLogPort, CallRecord, CallStatus } from "@antigravity-connector/core/Protocols/CallLogProtocol.ts";
import { ModelNotFoundError } from "@antigravity-connector/core/Errors/ModelNotFoundError.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { LogUtil } from "@antigravity-connector/core/Utils/LogUtil.ts";
import { RunPromptUtil } from "@antigravity-connector/core/Utils/RunPromptUtil.ts";
import { RunProfileUtil } from "@antigravity-connector/core/Utils/RunProfileUtil.ts";

export type AgyRunServiceOptions = {
  runner: AgyRunnerPort;
  queue: QueueService;
  limits: DailyLimitService;
  session: AgySessionService;
  baseTimeoutMs: number;
  clock: () => number;
  logSink: LogSink;
  secrets: readonly string[];
  callLog: CallLogPort;
};

export type CallResult = "success" | "error" | "stopped";

export type DetailFields = {
  exitCode?: number;
  envelopeStatus?: string;
  envelopeError?: string;
};

export type CallOutcome = {
  result: CallResult;
  usage?: AgyUsage;
  errorCode?: string;
  detail?: LogFieldToValue;
};

export class AgyRunService {
  static readonly CALL_EVENT = "agy.call.finished";

  static readonly UNKNOWN_ERROR_CODE = "unknown";

  static readonly RESULT_TO_LEVEL: Readonly<Record<CallResult, "info" | "warn" | "error">> = {
    success: "info",
    error: "error",
    stopped: "warn",
  };

  private readonly runner: AgyRunnerPort;

  private readonly queue: QueueService;

  private readonly limits: DailyLimitService;

  private readonly session: AgySessionService;

  private readonly baseTimeoutMs: number;

  private readonly clock: () => number;

  private readonly logSink: LogSink;

  private readonly secrets: readonly string[];

  private readonly callLog: CallLogPort;

  constructor(options: AgyRunServiceOptions) {
    this.runner = options.runner;
    this.queue = options.queue;
    this.limits = options.limits;
    this.session = options.session;
    this.baseTimeoutMs = options.baseTimeoutMs;
    this.clock = options.clock;
    this.logSink = options.logSink;
    this.secrets = options.secrets;
    this.callLog = options.callLog;
  }

  async run(kind: RunKind, input: RunInput, signal?: AbortSignal, observer?: RunObserver): Promise<AgyRunResult> {
    const request = this.prepare(kind, input);
    this.limits.consume(kind);
    const startedAtMs = this.clock();
    try {
      const hooks = AgyRunService.buildHooks(observer);
      const result = await this.queue.run(() => this.runChecked(request, signal), signal, hooks);
      this.logCall(kind, input, startedAtMs, {
        result: "success",
        usage: result.envelope.usage,
        detail: AgyRunService.buildSuccessDetail(result.envelope.num_turns, Object.keys(result.outputFiles).length),
      });
      return result;
    } catch (error: unknown) {
      this.handleFailure(error);
      this.logCall(kind, input, startedAtMs, {
        result: "error",
        errorCode: AgyRunService.readCode(error),
        detail: AgyRunService.buildFailureDetail(error),
      });
      throw error;
    }
  }

  openStream(
    kind: RunKind,
    input: RunInput,
    signal?: AbortSignal,
    observer?: RunObserver,
  ): Promise<AsyncIterable<AgyStreamOutputEvent>> {
    const request = this.prepare(kind, input);
    this.session.assertNotKnownDown();
    this.limits.consume(kind);
    const events = this.readStream(kind, input, request, signal, observer);
    return Promise.resolve(events);
  }

  async* stream(
    kind: RunKind,
    input: RunInput,
    signal?: AbortSignal,
    observer?: RunObserver,
  ): AsyncGenerator<AgyStreamOutputEvent> {
    const events = await this.openStream(kind, input, signal, observer);
    yield* events;
  }

  private async* readStream(
    kind: RunKind,
    input: RunInput,
    request: AgyRunRequest,
    signal: AbortSignal | undefined,
    observer: RunObserver | undefined,
  ): AsyncGenerator<AgyStreamOutputEvent> {
    const startedAtMs = this.clock();
    const buffer = new AsyncEventBufferService<AgyStreamOutputEvent>();
    const controller = new AbortController();
    const onAbort = (): void => {
      controller.abort();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const hooks = AgyRunService.buildHooks(observer);
    void this.queue
      .run(() => this.runStream(request, buffer, controller.signal), signal, hooks)
      .catch((error: unknown) => {
        buffer.end(error);
      });
    let usage: AgyUsage | undefined = undefined;
    try {
      for await (const event of buffer.readItems()) {
        usage = AgyRunService.readUsage(event) ?? usage;
        AgyRunService.notify(observer, event);
        if (AgyRunService.isForwarded(event)) {
          yield event;
        }
      }
      const outcome: CallOutcome = usage === undefined ? { result: "stopped" } : { result: "success", usage };
      this.logCall(kind, input, startedAtMs, outcome);
    } catch (error: unknown) {
      this.handleFailure(error);
      this.logCall(kind, input, startedAtMs, { result: "error", errorCode: AgyRunService.readCode(error) });
      throw error;
    } finally {
      signal?.removeEventListener("abort", onAbort);
      controller.abort();
    }
  }

  private async runChecked(request: AgyRunRequest, signal: AbortSignal | undefined): Promise<AgyRunResult> {
    await this.session.ensureConnected();
    return this.runner.run(request, signal);
  }

  private async runStream(
    request: AgyRunRequest,
    buffer: AsyncEventBufferService<AgyStreamOutputEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    await this.session.ensureConnected();
    for await (const event of this.runner.stream(request, signal)) {
      buffer.push(event);
    }
    buffer.end();
  }

  private prepare(kind: RunKind, input: RunInput): AgyRunRequest {
    const effort = input.effort ?? RunProfileUtil.DEFAULT_EFFORT;
    const modelSlug = ModelCatalogueUtil.resolveSlug(input.model, effort);
    if (modelSlug === undefined) {
      throw new ModelNotFoundError(input.model);
    }
    const attachments = input.attachments ?? [];
    return {
      attachments,
      modelSlug,
      prompt: RunPromptUtil.build(kind, input.messages, attachments.map((attachment) => attachment.fileName)),
      profile: RunProfileUtil.build(kind, this.baseTimeoutMs),
      conversationId: input.conversationId,
      jsonSchema: input.jsonSchema,
    };
  }

  private handleFailure(error: unknown): void {
    if (error instanceof AgySessionRequiredError) {
      this.session.reportSessionRequired(error.loginUrl);
    }
  }

  private logCall(kind: RunKind, input: RunInput, startedAtMs: number, outcome: CallOutcome): void {
    const fieldNameToValue: LogFieldToValue = {
      door: input.door,
      durationMs: this.clock() - startedAtMs,
      kind,
      model: input.model,
      result: outcome.result,
      ...AgyRunService.buildUsageFields(outcome.usage),
      ...AgyRunService.buildErrorFields(outcome.errorCode),
      ...outcome.detail,
    };
    const record = AgyRunService.buildCallRecord(kind, input, startedAtMs, this.clock(), outcome);
    this.callLog.write(record);
    LogUtil.write(
      {
        level: AgyRunService.RESULT_TO_LEVEL[outcome.result],
        event: AgyRunService.CALL_EVENT,
        metadata: fieldNameToValue,
      },
      { now: new Date(this.clock()), secrets: this.secrets, sink: this.logSink },
    );
  }

  static buildCallRecord(
    kind: RunKind,
    input: RunInput,
    startedAtMs: number,
    endedAtMs: number,
    outcome: CallOutcome,
  ): CallRecord {
    const status: CallStatus = outcome.result;
    return {
      kind,
      status,
      startedAt: new Date(startedAtMs).toISOString(),
      door: input.door,
      routeOrTool: input.source ?? kind,
      model: input.model,
      durationMs: endedAtMs - startedAtMs,
      inputTokens: outcome.usage?.input_tokens ?? null,
      outputTokens: outcome.usage?.output_tokens ?? null,
      totalTokens: outcome.usage?.total_tokens ?? null,
    };
  }

  static buildHooks(observer: RunObserver | undefined): QueueHooks {
    return {
      onWaiting: (position) => {
        observer?.({ kind: "queued", position });
      },
      onStarted: () => {
        observer?.({ kind: "started" });
      },
    };
  }

  static notify(observer: RunObserver | undefined, event: AgyStreamOutputEvent): void {
    const progress = AgyRunService.readActivityProgress(event) ?? AgyRunService.readTextProgress(event);
    if (progress !== undefined) {
      observer?.(progress);
    }
  }

  static isForwarded(event: AgyStreamOutputEvent): boolean {
    return event.kind !== "activity";
  }

  static readActivityProgress(event: AgyStreamOutputEvent): RunProgressEvent | undefined {
    if (event.kind !== "activity") {
      return undefined;
    }
    return { kind: "activity", stepType: event.stepType };
  }

  static readTextProgress(event: AgyStreamOutputEvent): RunProgressEvent | undefined {
    if (event.kind !== "text") {
      return undefined;
    }
    return { kind: "text" };
  }

  static readUsage(event: AgyStreamOutputEvent): AgyUsage | undefined {
    if (event.kind !== "finished") {
      return undefined;
    }
    return event.envelope.usage;
  }

  static buildUsageFields(usage: AgyUsage | undefined): LogFieldToValue {
    if (usage === undefined) {
      return {};
    }
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      thinkingTokens: usage.thinking_tokens,
      cacheReadTokens: usage.cache_read_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  static buildSuccessDetail(numTurns: number | undefined, outputFileCount: number): LogFieldToValue {
    return { numTurns: numTurns ?? 0, outputFileCount };
  }

  static buildFailureDetail(error: unknown): LogFieldToValue {
    if (error instanceof AgyAbortedError) {
      return { reason: "client_aborted" };
    }
    if (error instanceof AgyTimeoutError) {
      return { reason: "agy_timeout" };
    }
    if (!(error instanceof AgyFailedError)) {
      return {};
    }
    const fields: DetailFields = {};
    if (error.exitCode !== null) {
      fields.exitCode = error.exitCode;
    }
    if (error.envelopeStatus !== undefined) {
      fields.envelopeStatus = error.envelopeStatus;
    }
    if (error.envelopeError !== undefined) {
      fields.envelopeError = error.envelopeError;
    }
    return fields;
  }

  static buildErrorFields(errorCode: string | undefined): LogFieldToValue {
    return errorCode === undefined ? {} : { errorCode };
  }

  static readCode(error: unknown): string {
    if (error instanceof Error && "code" in error && typeof error.code === "string") {
      return error.code;
    }
    return AgyRunService.UNKNOWN_ERROR_CODE;
  }
}
