import type { ModelId } from "@antigravity-connector/protocol";

export type ResearchInput = {
  topic: string;
  model?: ModelId;
};
