import { z } from "zod";
import type { ImageGenerationRequest } from "@antigravity-connector/protocol/Protocols/OpenAiImageProtocol.ts";

export const ImageGenerationRequestSchema: z.ZodType<ImageGenerationRequest> = z.looseObject({
  prompt: z.string().min(1),
  model: z.string().optional(),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
  response_format: z.literal("b64_json").optional(),
});
