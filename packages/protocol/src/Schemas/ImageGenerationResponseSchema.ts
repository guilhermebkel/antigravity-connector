import { z } from "zod";
import type { ImageGenerationResponse } from "@antigravity-connector/protocol/Protocols/OpenAiImageProtocol.ts";

export const ImageGenerationResponseSchema: z.ZodType<ImageGenerationResponse> = z.looseObject({
  created: z.number(),
  data: z.array(z.looseObject({ b64_json: z.string() })),
});
