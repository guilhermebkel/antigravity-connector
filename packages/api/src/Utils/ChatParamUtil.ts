import type { ChatCompletionRequest, ReasoningEffort } from "@antigravity-connector/protocol";

export class ChatParamUtil {
  static readonly IGNORED_PARAM_NAMES: readonly (keyof ChatCompletionRequest)[] = [
    "temperature",
    "top_p",
    "max_tokens",
    "max_completion_tokens",
  ];

  static readonly DEFAULT_EFFORT: ReasoningEffort = "medium";

  static readonly SUPPORTED_EFFORTS: readonly ReasoningEffort[] = ["low", "medium", "high"];

  static readonly NO_TOOL_CHOICE = "none";

  static readIgnoredParams(request: ChatCompletionRequest): string[] {
    return ChatParamUtil.IGNORED_PARAM_NAMES.filter((name) => request[name] !== undefined);
  }

  static hasToolRequest(request: ChatCompletionRequest): boolean {
    const hasTools = request.tools !== undefined && request.tools.length > 0;
    const hasToolChoice = request.tool_choice !== undefined && request.tool_choice !== ChatParamUtil.NO_TOOL_CHOICE;
    return hasTools || hasToolChoice;
  }

  static isSupportedEffort(effort: string): effort is ReasoningEffort {
    return ChatParamUtil.SUPPORTED_EFFORTS.some((supported) => supported === effort);
  }
}
