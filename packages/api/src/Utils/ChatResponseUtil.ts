import type { AgyRunResult } from "@antigravity-connector/core";
import type { ChatCompletionResponse } from "@antigravity-connector/protocol";
import { OpenAiUsageUtil } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

export class ChatResponseUtil {
  static readonly FINISH_REASON = "stop";

  static readonly MS_PER_SECOND = 1000;

  static readonly MISSING_STRUCTURED_MESSAGE = "agy finished without structured output for response_format.";

  static build(result: AgyRunResult, model: string, createdAtMs: number, hasSchema: boolean): ChatCompletionResponse {
    const envelope = result.envelope;
    const content = hasSchema ? ChatResponseUtil.readStructuredText(envelope.structured_output) : envelope.response;
    return {
      model,
      id: `chatcmpl-${envelope.conversation_id}`,
      object: "chat.completion",
      created: Math.floor(createdAtMs / ChatResponseUtil.MS_PER_SECOND),
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: ChatResponseUtil.FINISH_REASON,
        },
      ],
      usage: OpenAiUsageUtil.map(envelope.usage),
      conversation_id: envelope.conversation_id,
    };
  }

  static readStructuredText(structuredOutput: unknown): string {
    if (structuredOutput === undefined) {
      throw new ApiRequestError("agy_failed", null, ChatResponseUtil.MISSING_STRUCTURED_MESSAGE);
    }
    return JSON.stringify(structuredOutput);
  }
}
