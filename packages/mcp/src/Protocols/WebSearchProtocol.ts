import type { ModelId } from "@antigravity-connector/protocol";

export type WebSearchInput = {
  query: string;
  model?: ModelId;
};

export type WebSearchSource = {
  title: string;
  url: string;
};

export type WebSearchOutput = {
  answer: string;
  sources: WebSearchSource[];
  model: string;
  durationMs: number;
  totalTokens: number;
};
