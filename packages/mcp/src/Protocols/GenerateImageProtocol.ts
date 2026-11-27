import type { ModelId } from "@antigravity-connector/protocol";

export type GenerateImageInput = {
  prompt: string;
  model?: ModelId;
  images?: string[];
};
