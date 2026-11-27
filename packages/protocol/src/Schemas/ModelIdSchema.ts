import { z } from "zod";
import type { ModelId } from "@antigravity-connector/protocol/Protocols/ModelIdProtocol.ts";

export const ModelIdSchema: z.ZodType<ModelId> = z.enum([
  "gemini-4-neon",
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "gemini-4-argon",
  "gemini-3.8-flash",
]);
