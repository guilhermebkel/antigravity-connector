import type { OpenAiMessage } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

export class ChatConversationUtil {
  static readLastUserMessage(messages: readonly OpenAiMessage[]): OpenAiMessage[] {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (lastUser === undefined) {
      throw new ApiRequestError("invalid_request_error", "messages", "A continued conversation needs a user message.");
    }
    return [lastUser];
  }
}
