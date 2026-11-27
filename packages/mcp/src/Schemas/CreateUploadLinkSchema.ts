import { z } from "zod";
import type {
  CreateUploadLinkInput,
  CreateUploadLinkOutput,
  UploadTokenParams,
} from "@antigravity-connector/mcp/Protocols/CreateUploadLinkProtocol.ts";

const TOKEN_MAX_LENGTH = 128;

export const CreateUploadLinkInputSchema: z.ZodType<CreateUploadLinkInput> = z.strictObject({
  kind: z.enum(["image", "audio", "video"]).optional().describe("What the file is. Default image."),
});

export const CreateUploadLinkOutputSchema: z.ZodType<CreateUploadLinkOutput> = z.strictObject({
  uploadPath: z.string().describe("Path of the one-time upload link, on the host of this MCP server."),
  uploadUrl: z.string().optional().describe("Full upload URL, present when the server knows its public address."),
  kind: z.enum(["image", "audio", "video"]).describe("What the link accepts."),
  file: z.string().describe("Value to pass to the tool that reads the file once it is uploaded: the images field of generate_image, or the file field of transcribe_audio or analyse_video."),
  image: z.string().describe("Same value as file; kept for clients that read this name."),
  expiresInSeconds: z.number().int().describe("Seconds the link works for."),
  maxBytes: z.number().int().describe("Largest file the link accepts."),
});

export const UploadTokenParamsSchema: z.ZodType<UploadTokenParams> = z.strictObject({
  token: z.string().min(1).max(TOKEN_MAX_LENGTH),
});
