export type GenerateImageInput = {
  prompt: string;
  model?: "gemini-4-argon" | "gemini-3.8-flash";
};

export type GenerateImageOutput = {
  mimeType: "image/png";
  sizeBytes: number;
  model: string;
  durationMs: number;
  totalTokens: number;
};
