import type { AgyStreamOutputEvent } from "@antigravity-connector/core";

export type ChatStreamOpening = {
  events: AsyncIterable<AgyStreamOutputEvent>;
  ignoredParams: readonly string[];
  id: string;
  createdAtMs: number;
  model: string;
  shouldIncludeUsage: boolean;
  hasSchema: boolean;
};
