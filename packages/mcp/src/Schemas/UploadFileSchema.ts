import { z } from "zod";
import { UploadReferenceUtil } from "@antigravity-connector/core";

export const buildUploadFileSchema = (kind: "audio" | "video"): z.ZodType<string> => z
  .string()
  .refine((value) => UploadReferenceUtil.readImageId(value) !== undefined, {
    message: `The file is not valid. What to do: call create_upload_link with kind "${kind}", upload the file, and pass the file value exactly as it returned.`,
  });
