import type { ChatCompletionChunk, OpenAiFinishReason, OpenAiUsage } from "@antigravity-connector/protocol";
import type { ApiErrorBody } from "@antigravity-connector/api/Protocols/ApiErrorDetailProtocol.ts";

export type ChunkContext = {
  id: string;
  created: number;
  model: string;
};

export type ChunkDelta = {
  role?: "assistant";
  content?: string;
};

export class ChatChunkUtil {
  static readonly MS_PER_SECOND = 1000;

  static readonly DONE_EVENT = "data: [DONE]\n\n";

  static readonly KEEP_ALIVE_LINE = ": keep-alive\n\n";

  static buildChunk(
    context: ChunkContext,
    delta: ChunkDelta,
    finishReason: OpenAiFinishReason | null,
  ): ChatCompletionChunk {
    return {
      model: context.model,
      id: context.id,
      object: "chat.completion.chunk",
      created: context.created,
      choices: [{ delta, index: 0, finish_reason: finishReason }],
    };
  }

  static buildUsageChunk(context: ChunkContext, usage: OpenAiUsage): ChatCompletionChunk {
    return {
      usage,
      model: context.model,
      id: context.id,
      object: "chat.completion.chunk",
      created: context.created,
      choices: [],
    };
  }

  static formatEvent(payload: unknown): string {
    return `data: ${JSON.stringify(payload)}\n\n`;
  }

  static formatErrorEvent(body: ApiErrorBody): string {
    return ChatChunkUtil.formatEvent(body);
  }

  static readCreatedSeconds(createdAtMs: number): number {
    return Math.floor(createdAtMs / ChatChunkUtil.MS_PER_SECOND);
  }
}
