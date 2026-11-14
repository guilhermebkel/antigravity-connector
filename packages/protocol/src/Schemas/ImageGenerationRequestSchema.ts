import { z } from "zod";
import type { ImageGenerationRequest } from "@antigravity-connector/protocol/Protocols/OpenAiImageProtocol.ts";

export const ImageGenerationRequestSchema: z.ZodType<ImageGenerationRequest> = z.looseObject({
  prompt: z.string().min(1),
  model: z.string().optional(),
  n: z.number().int().optional(),
  size: z.string().optional(),
  quality: z.string().optional(),
  style: z.string().optional(),
  response_format: z.string().optional(),
});
