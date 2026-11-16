import { z } from "zod";
import type {
  CreateUploadLinkInput,
  CreateUploadLinkOutput,
  UploadTokenParams,
} from "@antigravity-connector/mcp/Protocols/CreateUploadLinkProtocol.ts";

const TOKEN_MAX_LENGTH = 128;

export const CreateUploadLinkInputSchema: z.ZodType<CreateUploadLinkInput> = z.strictObject({});

export const CreateUploadLinkOutputSchema: z.ZodType<CreateUploadLinkOutput> = z.strictObject({
  uploadPath: z.string().describe("Path of the one-time upload link, on the host of this MCP server."),
  image: z.string().describe("Value to put in the images field of generate_image once the file is uploaded."),
  expiresInSeconds: z.number().int().describe("Seconds the link works for."),
  maxBytes: z.number().int().describe("Largest file the link accepts."),
});

export const UploadTokenParamsSchema: z.ZodType<UploadTokenParams> = z.strictObject({
  token: z.string().min(1).max(TOKEN_MAX_LENGTH),
});
