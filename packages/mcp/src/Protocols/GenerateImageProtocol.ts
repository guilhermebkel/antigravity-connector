export type GenerateImageInput = {
  prompt: string;
  model?: "gemini-4-argon" | "gemini-3.8-flash";
  images?: string[];
};
