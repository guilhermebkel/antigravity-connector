import type { ModelId } from "@antigravity-connector/protocol";

export type AnalyseVideoInput = {
  file: string;
  question: string;
  model?: ModelId;
};
