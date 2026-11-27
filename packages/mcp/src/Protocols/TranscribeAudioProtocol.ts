import type { ModelId } from "@antigravity-connector/protocol";

export type TranscribeAudioInput = {
  file: string;
  language?: string;
  format?: "plain" | "timestamped";
  model?: ModelId;
};
