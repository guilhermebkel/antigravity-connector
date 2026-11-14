import type { AgyUsage } from "@antigravity-connector/protocol";
import type { AgyStreamOutputEvent } from "@antigravity-connector/core";
import { OpenAiUsageUtil } from "@antigravity-connector/protocol";
import type { ChatStreamOpening } from "@antigravity-connector/api/Protocols/ChatStreamOpeningProtocol.ts";
import { ChatChunkUtil, type ChunkContext, type ChunkDelta } from "@antigravity-connector/api/Utils/ChatChunkUtil.ts";

export class ChatStreamService {
  static readonly STOP_REASON = "stop";

  static readonly ROLE_DELTA: ChunkDelta = { role: "assistant" };

  static readText(event: AgyStreamOutputEvent): string | undefined {
    if (event.kind !== "text") {
      return undefined;
    }
    return event.delta;
  }

  static readUsage(event: AgyStreamOutputEvent): AgyUsage | undefined {
    if (event.kind !== "finished") {
      return undefined;
    }
    return event.envelope.usage;
  }

  static async* buildLines(opening: ChatStreamOpening): AsyncGenerator<string> {
    const context: ChunkContext = {
      model: opening.model,
      id: opening.id,
      created: ChatChunkUtil.readCreatedSeconds(opening.createdAtMs),
    };
    let hasSentRole = false;
    let usage: AgyUsage | undefined = undefined;
    for await (const event of opening.events) {
      const text = ChatStreamService.readText(event);
      if (text !== undefined) {
        const delta: ChunkDelta = hasSentRole ? { content: text } : { role: "assistant", content: text };
        hasSentRole = true;
        const chunk = ChatChunkUtil.buildChunk(context, delta, null);
        yield ChatChunkUtil.formatEvent(chunk);
      }
      usage = ChatStreamService.readUsage(event) ?? usage;
    }
    if (!hasSentRole) {
      const roleChunk = ChatChunkUtil.buildChunk(context, ChatStreamService.ROLE_DELTA, null);
      yield ChatChunkUtil.formatEvent(roleChunk);
    }
    const finishChunk = ChatChunkUtil.buildChunk(context, {}, ChatStreamService.STOP_REASON);
    yield ChatChunkUtil.formatEvent(finishChunk);
    if (opening.shouldIncludeUsage && usage !== undefined) {
      const mappedUsage = OpenAiUsageUtil.map(usage);
      yield ChatChunkUtil.formatEvent(ChatChunkUtil.buildUsageChunk(context, mappedUsage));
    }
    yield ChatChunkUtil.DONE_EVENT;
  }
}
