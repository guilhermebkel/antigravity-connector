import { z } from "zod";
import type { GenerateImageInput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";

const GENERATE_IMAGE_PROMPT_MAX_LENGTH = 2000;

export const GenerateImageInputSchema: z.ZodType<GenerateImageInput> = z.strictObject({
  prompt: z.string().trim().min(1).max(GENERATE_IMAGE_PROMPT_MAX_LENGTH),
  model: z.enum(["gemini-4-argon", "gemini-3.8-flash"]).optional(),
});
