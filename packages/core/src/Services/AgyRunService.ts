import { AsyncEventBufferService, ModelCatalogueUtil, type AgyUsage, type RunKind } from "@antigravity-connector/protocol";
import type { AgyRunRequest, AgyRunResult, AgyRunnerPort, AgyStreamOutputEvent } from "@antigravity-connector/agy";
import { AgySessionRequiredError } from "@antigravity-connector/agy";
import type { RunInput } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { LogFieldToValue, LogSink } from "@antigravity-connector/core/Protocols/LogProtocol.ts";
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
};

export type CallResult = "success" | "error" | "stopped";

export type CallOutcome = {
  result: CallResult;
  usage?: AgyUsage;
  errorCode?: string;
};

export class AgyRunService {
  static readonly CALL_EVENT = "agy_call";

  static readonly UNKNOWN_ERROR_CODE = "unknown";

  static readonly RESULT_TO_LEVEL: Readonly<Record<CallResult, "info" | "warn">> = {
    success: "info",
    error: "warn",
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

  constructor(options: AgyRunServiceOptions) {
    this.runner = options.runner;
    this.queue = options.queue;
    this.limits = options.limits;
    this.session = options.session;
    this.baseTimeoutMs = options.baseTimeoutMs;
    this.clock = options.clock;
    this.logSink = options.logSink;
    this.secrets = options.secrets;
  }

  async run(kind: RunKind, input: RunInput, signal?: AbortSignal): Promise<AgyRunResult> {
    const request = this.prepare(kind, input);
    this.limits.consume(kind);
    const startedAtMs = this.clock();
    try {
      const result = await this.queue.run(() => this.runChecked(request, signal), signal);
      this.logCall(kind, input, startedAtMs, { result: "success", usage: result.envelope.usage });
      return result;
    } catch (error: unknown) {
      this.handleFailure(error);
      this.logCall(kind, input, startedAtMs, { result: "error", errorCode: AgyRunService.readCode(error) });
      throw error;
    }
  }

  async* stream(kind: RunKind, input: RunInput, signal?: AbortSignal): AsyncGenerator<AgyStreamOutputEvent> {
    const request = this.prepare(kind, input);
    this.limits.consume(kind);
    const startedAtMs = this.clock();
    const buffer = new AsyncEventBufferService<AgyStreamOutputEvent>();
    const controller = new AbortController();
    void this.queue
      .run(() => this.runStream(request, buffer, controller.signal), signal)
      .catch((error: unknown) => {
        buffer.end(error);
      });
    let usage: AgyUsage | undefined = undefined;
    try {
      for await (const event of buffer.readItems()) {
        usage = AgyRunService.readUsage(event) ?? usage;
        yield event;
      }
      const outcome: CallOutcome = usage === undefined ? { result: "stopped" } : { result: "success", usage };
      this.logCall(kind, input, startedAtMs, outcome);
    } catch (error: unknown) {
      this.handleFailure(error);
      this.logCall(kind, input, startedAtMs, { result: "error", errorCode: AgyRunService.readCode(error) });
      throw error;
    } finally {
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
    return {
      modelSlug,
      prompt: RunPromptUtil.build(kind, input.messages),
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
    };
    LogUtil.write(
      {
        level: AgyRunService.RESULT_TO_LEVEL[outcome.result],
        event: AgyRunService.CALL_EVENT,
        metadata: fieldNameToValue,
      },
      { now: new Date(this.clock()), secrets: this.secrets, sink: this.logSink },
    );
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
