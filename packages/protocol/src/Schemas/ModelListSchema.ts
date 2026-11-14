import { z } from "zod";
import type { ModelList } from "@antigravity-connector/protocol/Protocols/OpenAiModelProtocol.ts";

export const ModelListSchema: z.ZodType<ModelList> = z.looseObject({
  object: z.literal("list"),
  data: z.array(
    z.looseObject({
      id: z.string(),
      object: z.literal("model"),
      created: z.number(),
      owned_by: z.string(),
    }),
  ),
});
