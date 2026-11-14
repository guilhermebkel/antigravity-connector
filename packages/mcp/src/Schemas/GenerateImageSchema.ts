import { z } from "zod";
import type { GenerateImageInput, GenerateImageOutput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";

const GENERATE_IMAGE_PROMPT_MAX_LENGTH = 2000;

export const GenerateImageInputSchema: z.ZodType<GenerateImageInput> = z.strictObject({
  prompt: z.string().trim().min(1).max(GENERATE_IMAGE_PROMPT_MAX_LENGTH),
  model: z.enum(["gemini-4-argon", "gemini-3.8-flash"]).optional(),
});

export const GenerateImageOutputSchema: z.ZodType<GenerateImageOutput> = z.object({
  mimeType: z.literal("image/png"),
  sizeBytes: z.number(),
  model: z.string(),
  durationMs: z.number(),
  totalTokens: z.number(),
});
