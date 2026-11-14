import type { ModelId } from "@antigravity-connector/protocol";

export type BrowseInput = {
  task: string;
  url?: string;
  screenshot?: boolean;
  model?: ModelId;
};

export type BrowseOutput = {
  text: string;
  hasScreenshot: boolean;
  model: string;
  durationMs: number;
  totalTokens: number;
};
