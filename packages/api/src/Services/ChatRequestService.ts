import type { ChatCompletionRequest, OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ChatParamUtil } from "@antigravity-connector/api/Utils/ChatParamUtil.ts";

export class ChatRequestService {
  static check(request: ChatCompletionRequest): void {
    if (request.stream === true) {
      throw new ApiRequestError("invalid_request_error", "stream", "Streaming is not available on this server yet.");
    }
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
    const type = request.response_format?.type;
    if (type !== undefined && type !== "text") {
      throw new ApiRequestError(
        "invalid_request_error",
        "response_format",
        `response_format type ${type} is not supported yet; use text.`,
      );
    }
  }

  static checkMessages(messages: readonly OpenAiMessage[]): void {
    const hasImage = messages.some((message) => typeof message.content !== "string"
      && message.content.some((part) => part.type === "image_url"));
    if (hasImage) {
      throw new ApiRequestError("invalid_request_error", "messages", "image_url content parts are not supported yet.");
    }
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
