import { z } from "zod";
import { ModelIdSchema } from "@antigravity-connector/protocol";
import type { GenerateImageInput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";
import {
  ImageInputUtil,
  RemoteImageError,
  RemoteImageUrlUtil,
  UploadReferenceUtil,
  type ImageInputReason,
} from "@antigravity-connector/core";

const GENERATE_IMAGE_PROMPT_MAX_LENGTH = 2000;
const DATA_URL_PREFIX = "data:";

const REASON_TO_MESSAGE: Readonly<Record<ImageInputReason, string>> = {
  not_data_url: "must be an https:// URL, a base64 data: URL of a PNG, JPEG or WebP image, or the image value from create_upload_link.",
  too_large: "is larger than 4 MiB.",
  signature_mismatch: "does not match its declared image type.",
};

const validateDataUrl = (url: string, context: z.RefinementCtx): void => {
  const result = ImageInputUtil.parse(url);
  if (!result.isValid) {
    context.addIssue({ code: "custom", message: `The reference image ${REASON_TO_MESSAGE[result.reason]}` });
  }
};

const validateRemoteUrl = (url: string, context: z.RefinementCtx): void => {
  const result = RemoteImageUrlUtil.parse(url);
  if (!result.isValid) {
    context.addIssue({ code: "custom", message: new RemoteImageError(result.reason).message });
  }
};

const validateUploadReference = (reference: string, context: z.RefinementCtx): void => {
  if (UploadReferenceUtil.readImageId(reference) === undefined) {
    context.addIssue({
      code: "custom",
      message: "The upload reference is not valid. What to do: pass the image value exactly as create_upload_link returned it.",
    });
  }
};

const validateReferenceImage = (url: string, context: z.RefinementCtx): void => {
  if (url.startsWith(DATA_URL_PREFIX)) {
    validateDataUrl(url, context);
    return;
  }
  if (url.startsWith(UploadReferenceUtil.PREFIX)) {
    validateUploadReference(url, context);
    return;
  }
  if (URL.canParse(url)) {
    validateRemoteUrl(url, context);
    return;
  }
  context.addIssue({ code: "custom", message: `The reference image ${REASON_TO_MESSAGE.not_data_url}` });
};

export const GenerateImageInputSchema: z.ZodType<GenerateImageInput> = z.strictObject({
  prompt: z.string().trim().min(1).max(GENERATE_IMAGE_PROMPT_MAX_LENGTH),
  model: ModelIdSchema.optional(),
  images: z
    .array(z.string().max(ImageInputUtil.MAX_DATA_URL_LENGTH).superRefine(validateReferenceImage))
    .max(ImageInputUtil.MAX_IMAGES)
    .optional(),
});
