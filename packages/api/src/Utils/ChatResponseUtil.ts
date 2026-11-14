import type { AgyRunResult } from "@antigravity-connector/core";
import type { ChatCompletionResponse } from "@antigravity-connector/protocol";
import { OpenAiUsageUtil } from "@antigravity-connector/protocol";

export class ChatResponseUtil {
  static readonly FINISH_REASON = "stop";

  static readonly MS_PER_SECOND = 1000;

  static build(result: AgyRunResult, model: string, createdAtMs: number): ChatCompletionResponse {
    const envelope = result.envelope;
    return {
      model,
      id: `chatcmpl-${envelope.conversation_id}`,
      object: "chat.completion",
      created: Math.floor(createdAtMs / ChatResponseUtil.MS_PER_SECOND),
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: envelope.response },
          finish_reason: ChatResponseUtil.FINISH_REASON,
        },
      ],
      usage: OpenAiUsageUtil.map(envelope.usage),
      conversation_id: envelope.conversation_id,
    };
  }
}
