import type { ModelId } from "@antigravity-connector/protocol";

export type BrowseInput = {
  task: string;
  url?: string;
  screenshot?: boolean;
  model?: ModelId;
};
