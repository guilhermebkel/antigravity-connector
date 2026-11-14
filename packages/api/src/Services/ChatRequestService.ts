import type { ChatCompletionRequest, OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ChatParamUtil } from "@antigravity-connector/api/Utils/ChatParamUtil.ts";
import { ChatSchemaUtil } from "@antigravity-connector/api/Utils/ChatSchemaUtil.ts";
import { ChatAttachmentUtil } from "@antigravity-connector/api/Utils/ChatAttachmentUtil.ts";

export class ChatRequestService {
  static check(request: ChatCompletionRequest): void {
    if (ChatParamUtil.hasToolRequest(request)) {
      throw new ApiRequestError(
        "tools_not_supported",
        "tools",
        "Tool calling is not available through this server, because agy runs its own tools. Remove tools and tool_choice.",
      );
    }
    ChatRequestService.checkResponseFormat(request);
    ChatRequestService.checkMessages(request.messages);
    ChatRequestService.checkEffort(request);
  }

  static checkResponseFormat(request: ChatCompletionRequest): void {
    ChatSchemaUtil.readResponseSchema(request);
  }

  static checkMessages(messages: readonly OpenAiMessage[]): void {
    ChatAttachmentUtil.readAttachments(messages);
  }

  static checkEffort(request: ChatCompletionRequest): void {
    const effort = request.reasoning_effort;
    if (effort !== undefined && !ChatParamUtil.isSupportedEffort(effort)) {
      throw new ApiRequestError(
        "invalid_request_error",
        "reasoning_effort",
        `reasoning_effort ${effort} is not supported; use low, medium or high.`,
      );
    }
  }
}
