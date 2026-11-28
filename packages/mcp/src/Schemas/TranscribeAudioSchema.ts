import { z } from "zod";
import { ModelIdSchema, ModelInfoUtil } from "@antigravity-connector/protocol";
import type { TranscribeAudioInput } from "@antigravity-connector/mcp/Protocols/TranscribeAudioProtocol.ts";
import { buildUploadFileSchema } from "@antigravity-connector/mcp/Schemas/UploadFileSchema.ts";

const LANGUAGE_MAX_LENGTH = 40;

export const TranscribeAudioInputSchema: z.ZodType<TranscribeAudioInput> = z.strictObject({
  file: buildUploadFileSchema("audio"),
  language: z.string().trim().min(1).max(LANGUAGE_MAX_LENGTH).optional(),
  format: z.enum(["plain", "timestamped"]).optional(),
  model: ModelIdSchema.optional().describe(ModelInfoUtil.buildFieldDescription("The model that listens to the audio. Flash handled a short speech in about 5 s in our test.")),
});
