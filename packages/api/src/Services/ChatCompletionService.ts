import { randomUUID } from "node:crypto";
import type { AgyRunService, RunInput } from "@antigravity-connector/core";
import type { ChatCompletionRequest, ReasoningEffort } from "@antigravity-connector/protocol";
import type { ChatCompletionOutcome } from "@antigravity-connector/api/Protocols/ChatCompletionOutcomeProtocol.ts";
import type { ChatStreamOpening } from "@antigravity-connector/api/Protocols/ChatStreamOpeningProtocol.ts";
import { ChatRequestService } from "@antigravity-connector/api/Services/ChatRequestService.ts";
import { ChatParamUtil } from "@antigravity-connector/api/Utils/ChatParamUtil.ts";
import { ChatResponseUtil } from "@antigravity-connector/api/Utils/ChatResponseUtil.ts";
import { ChatSchemaUtil } from "@antigravity-connector/api/Utils/ChatSchemaUtil.ts";
import { ChatAttachmentUtil } from "@antigravity-connector/api/Utils/ChatAttachmentUtil.ts";
import { ChatConversationUtil } from "@antigravity-connector/api/Utils/ChatConversationUtil.ts";
import { ConversationIdUtil } from "@antigravity-connector/api/Utils/ConversationIdUtil.ts";
import type { ConversationRegistryService } from "@antigravity-connector/api/Services/ConversationRegistryService.ts";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

export type ChatCompletionServiceOptions = {
  runService: AgyRunService;
  clock: () => number;
  conversations: ConversationRegistryService;
};

type ConversationContext = {
  conversationId?: string;
  messages: ChatCompletionRequest["messages"];
};

export class ChatCompletionService {
  static readonly DOOR = "api";

  static readonly SOURCE = "/v1/chat/completions";

  private readonly runService: AgyRunService;

  private readonly clock: () => number;

  private readonly conversations: ConversationRegistryService;

  constructor(options: ChatCompletionServiceOptions) {
    this.runService = options.runService;
    this.clock = options.clock;
    this.conversations = options.conversations;
  }

  async complete(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionOutcome> {
    ChatRequestService.check(request);
    const ignoredParams = ChatParamUtil.readIgnoredParams(request);
    const input = this.buildRunInput(request);
    const result = await this.runService.run("chat", input, signal);
    this.conversations.save(result.envelope.conversation_id, request.model);
    const createdAtMs = this.clock();
    const isStructured = input.jsonSchema !== undefined;
    return { body: ChatResponseUtil.build(result, request.model, createdAtMs, isStructured), ignoredParams };
  }

  async openStream(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatStreamOpening> {
    ChatRequestService.check(request);
    const ignoredParams = ChatParamUtil.readIgnoredParams(request);
    const input = this.buildRunInput(request);
    const events = await this.runService.openStream("chat", input, signal);
    const isStructured = input.jsonSchema !== undefined;
    return {
      events: this.conversations.observe(events, request.model),
      id: `chatcmpl-${randomUUID()}`,
      createdAtMs: this.clock(),
      model: request.model,
      shouldIncludeUsage: request.stream_options?.include_usage === true,
      hasSchema: isStructured,
      ignoredParams,
    };
  }

  buildRunInput(request: ChatCompletionRequest): RunInput {
    const context = this.resolveConversation(request);
    return {
      effort: ChatCompletionService.readEffort(request),
      door: ChatCompletionService.DOOR,
      messages: context.messages,
      model: request.model,
      conversationId: context.conversationId,
      jsonSchema: ChatSchemaUtil.readResponseSchema(request),
      attachments: ChatAttachmentUtil.readAttachments(context.messages),
      source: ChatCompletionService.SOURCE,
    };
  }

  resolveConversation(request: ChatCompletionRequest): ConversationContext {
    const conversationId = request.conversation_id;
    if (conversationId === undefined) {
      return { messages: request.messages };
    }
    if (!ConversationIdUtil.isValid(conversationId)) {
      throw new ApiRequestError(
        "invalid_request_error",
        "conversation_id",
        "conversation_id must be 1 to 128 letters, digits, _ or -, starting with a letter or digit.",
      );
    }
    const model = this.conversations.readModel(conversationId);
    if (model === undefined) {
      throw new ApiRequestError(
        "invalid_request_error",
        "conversation_id",
        "conversation_id is unknown or expired. Resend the full history without conversation_id.",
      );
    }
    if (model !== request.model) {
      throw new ApiRequestError(
        "invalid_request_error",
        "conversation_id",
        "conversation_id belongs to another model. Use that model, or resend the full history without conversation_id.",
      );
    }
    return { conversationId, messages: ChatConversationUtil.readLastUserMessage(request.messages) };
  }

  static readEffort(request: ChatCompletionRequest): ReasoningEffort {
    const effort = request.reasoning_effort;
    if (effort !== undefined && ChatParamUtil.isSupportedEffort(effort)) {
      return effort;
    }
    return ChatParamUtil.DEFAULT_EFFORT;
  }
}
