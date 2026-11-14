import type { AgyStreamOutputEvent } from "@antigravity-connector/core";

export type ConversationRegistryOptions = { clock: () => number };

export type ConversationEntry = {
  model: string;
  lastUsedAtMs: number;
};

export class ConversationRegistryService {
  static readonly MAX_ENTRIES = 256;

  static readonly TTL_MS = 86400000;

  private readonly clock: () => number;

  private readonly conversationIdToEntry = new Map<string, ConversationEntry>();

  constructor(options: ConversationRegistryOptions) {
    this.clock = options.clock;
  }

  save(conversationId: string, model: string): void {
    this.conversationIdToEntry.delete(conversationId);
    this.conversationIdToEntry.set(conversationId, { model, lastUsedAtMs: this.clock() });
    this.dropOldest();
  }

  readModel(conversationId: string): string | undefined {
    const entry = this.conversationIdToEntry.get(conversationId);
    if (entry === undefined) {
      return undefined;
    }
    if (this.clock() - entry.lastUsedAtMs > ConversationRegistryService.TTL_MS) {
      this.conversationIdToEntry.delete(conversationId);
      return undefined;
    }
    this.save(conversationId, entry.model);
    return entry.model;
  }

  async* observe(events: AsyncIterable<AgyStreamOutputEvent>, model: string): AsyncGenerator<AgyStreamOutputEvent> {
    for await (const event of events) {
      const startedId = ConversationRegistryService.readStartedId(event);
      if (startedId !== undefined) {
        this.save(startedId, model);
      }
      yield event;
    }
  }

  static readStartedId(event: AgyStreamOutputEvent): string | undefined {
    if (event.kind !== "started") {
      return undefined;
    }
    return event.conversationId;
  }

  private dropOldest(): void {
    while (this.conversationIdToEntry.size > ConversationRegistryService.MAX_ENTRIES) {
      const oldest = this.conversationIdToEntry.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.conversationIdToEntry.delete(oldest);
    }
  }
}
