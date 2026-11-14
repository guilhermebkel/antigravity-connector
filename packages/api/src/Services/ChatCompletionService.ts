import { randomUUID } from "node:crypto";
import type { AgyRunService } from "@antigravity-connector/core";
import type { ChatCompletionRequest, ReasoningEffort } from "@antigravity-connector/protocol";
import type { ChatCompletionOutcome } from "@antigravity-connector/api/Protocols/ChatCompletionOutcomeProtocol.ts";
import type { ChatStreamOpening } from "@antigravity-connector/api/Protocols/ChatStreamOpeningProtocol.ts";
import { ChatRequestService } from "@antigravity-connector/api/Services/ChatRequestService.ts";
import { ChatParamUtil } from "@antigravity-connector/api/Utils/ChatParamUtil.ts";
import { ChatResponseUtil } from "@antigravity-connector/api/Utils/ChatResponseUtil.ts";

export type ChatCompletionServiceOptions = {
  runService: AgyRunService;
  clock: () => number;
};

export class ChatCompletionService {
  static readonly DOOR = "api";

  private readonly runService: AgyRunService;

  private readonly clock: () => number;

  constructor(options: ChatCompletionServiceOptions) {
    this.runService = options.runService;
    this.clock = options.clock;
  }

  async complete(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionOutcome> {
    ChatRequestService.check(request);
    const ignoredParams = ChatParamUtil.readIgnoredParams(request);
    const effort = ChatCompletionService.readEffort(request);
    const result = await this.runService.run(
      "chat",
      { effort, door: ChatCompletionService.DOOR, messages: request.messages, model: request.model },
      signal,
    );
    const createdAtMs = this.clock();
    return { body: ChatResponseUtil.build(result, request.model, createdAtMs), ignoredParams };
  }

  async openStream(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatStreamOpening> {
    ChatRequestService.check(request);
    const ignoredParams = ChatParamUtil.readIgnoredParams(request);
    const effort = ChatCompletionService.readEffort(request);
    const events = await this.runService.openStream(
      "chat",
      { effort, door: ChatCompletionService.DOOR, messages: request.messages, model: request.model },
      signal,
    );
    return {
      events,
      ignoredParams,
      id: `chatcmpl-${randomUUID()}`,
      createdAtMs: this.clock(),
      model: request.model,
      shouldIncludeUsage: request.stream_options?.include_usage === true,
    };
  }

  static readEffort(request: ChatCompletionRequest): ReasoningEffort {
    const effort = request.reasoning_effort;
    if (effort !== undefined && ChatParamUtil.isSupportedEffort(effort)) {
      return effort;
    }
    return ChatParamUtil.DEFAULT_EFFORT;
  }
}
