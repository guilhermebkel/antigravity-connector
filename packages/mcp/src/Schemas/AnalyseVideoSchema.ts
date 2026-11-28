import { z } from "zod";
import { ModelIdSchema, ModelInfoUtil } from "@antigravity-connector/protocol";
import type { AnalyseVideoInput } from "@antigravity-connector/mcp/Protocols/AnalyseVideoProtocol.ts";
import { buildUploadFileSchema } from "@antigravity-connector/mcp/Schemas/UploadFileSchema.ts";

const QUESTION_MAX_LENGTH = 2000;

export const AnalyseVideoInputSchema: z.ZodType<AnalyseVideoInput> = z.strictObject({
  file: buildUploadFileSchema("video"),
  question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH),
  model: ModelIdSchema.optional().describe(ModelInfoUtil.buildFieldDescription("The model that watches the video, with its sound. Hydrogen, Neon and Argon answered our video test correctly; Flash tried a shell command and returned nothing.")),
});
