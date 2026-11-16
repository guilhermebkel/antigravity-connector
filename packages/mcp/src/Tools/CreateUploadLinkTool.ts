import { ImageInputUtil, UploadReferenceUtil } from "@antigravity-connector/core";
import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type {
  CreateUploadLinkInput,
  CreateUploadLinkOutput,
} from "@antigravity-connector/mcp/Protocols/CreateUploadLinkProtocol.ts";
import {
  CreateUploadLinkInputSchema,
  CreateUploadLinkOutputSchema,
} from "@antigravity-connector/mcp/Schemas/CreateUploadLinkSchema.ts";
import { UploadPathUtil } from "@antigravity-connector/mcp/Utils/UploadPathUtil.ts";

export type CreateUploadLinkToolOptions = { publicUrl: string | undefined };

export class CreateUploadLinkTool implements McpToolPort<CreateUploadLinkInput, CreateUploadLinkOutput> {
  readonly name = "create_upload_link";

  readonly title = "Create upload link";

  readonly description: string;

  readonly inputSchema = CreateUploadLinkInputSchema;

  readonly outputSchema = CreateUploadLinkOutputSchema;

  readonly annotations = { readOnlyHint: false, openWorldHint: false };

  private readonly publicUrl: string | undefined;

  constructor(options: CreateUploadLinkToolOptions) {
    this.publicUrl = options.publicUrl;
    this.description = [
      "Creates a one-time link to upload a reference picture to this server, so its bytes never pass through a tool call.",
      "Use it when a PNG, JPEG or WebP file sits on a machine that can send an HTTP request (for example with curl) and a public https:// URL does not exist.",
      "Do not use it when the picture already has a public https:// URL: pass that URL to generate_image.",
      "Returns uploadPath, uploadUrl, image, expiresInSeconds and maxBytes.",
      "Send the file as the raw body of a POST to uploadUrl; the link is the credential, so no Authorization header is needed.",
      "uploadUrl is present only when the owner set PUBLIC_URL on the server; otherwise POST uploadPath on the host of this MCP server.",
      "For example: curl --data-binary @photo.jpg \"$UPLOAD_URL\".",
      "The answer is JSON with the same image value: put it in the images field of generate_image.",
      "The link works once and expires in 5 minutes; the uploaded picture is kept for 15 minutes and can be used by several calls.",
      "It starts no agy run and spends no quota.",
    ].join(" ");
  }

  run(_input: CreateUploadLinkInput, context: McpToolContext): Promise<McpToolRun<CreateUploadLinkOutput>> {
    const link = context.imageUploadService.createLink();
    const uploadPath = UploadPathUtil.build(link.token);
    const uploadUrl = this.publicUrl === undefined ? {} : { uploadUrl: new URL(uploadPath, this.publicUrl).href };
    return Promise.resolve({
      output: {
        uploadPath,
        ...uploadUrl,
        image: UploadReferenceUtil.build(link.imageId),
        expiresInSeconds: link.expiresInSeconds,
        maxBytes: ImageInputUtil.MAX_IMAGE_BYTES,
      },
      extraContent: [],
    });
  }

  summarize(output: CreateUploadLinkOutput): string {
    return `Upload the file with POST ${output.uploadUrl ?? output.uploadPath}, then pass ${output.image} in the images field of generate_image.`;
  }
}
