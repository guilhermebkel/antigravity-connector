import { z } from "zod";
import type { GenerateImageInput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";
import { ImageInputUtil, type ImageInputReason } from "@antigravity-connector/core";

const GENERATE_IMAGE_PROMPT_MAX_LENGTH = 2000;

const REASON_TO_MESSAGE: Readonly<Record<ImageInputReason, string>> = {
  not_data_url: "must be a base64 data: URL of a PNG, JPEG or WebP image. Remote URLs are not fetched.",
  too_large: "is larger than 4 MiB.",
  signature_mismatch: "does not match its declared image type.",
};

const validateReferenceImage = (url: string, context: z.RefinementCtx): void => {
  const result = ImageInputUtil.parse(url);
  if (!result.isValid) {
    context.addIssue({ code: "custom", message: `The reference image ${REASON_TO_MESSAGE[result.reason]}` });
  }
};

export const GenerateImageInputSchema: z.ZodType<GenerateImageInput> = z.strictObject({
  prompt: z.string().trim().min(1).max(GENERATE_IMAGE_PROMPT_MAX_LENGTH),
  model: z.enum(["gemini-4-argon", "gemini-3.8-flash"]).optional(),
  images: z
    .array(z.string().max(ImageInputUtil.MAX_DATA_URL_LENGTH).superRefine(validateReferenceImage))
    .max(ImageInputUtil.MAX_IMAGES)
    .optional(),
});
