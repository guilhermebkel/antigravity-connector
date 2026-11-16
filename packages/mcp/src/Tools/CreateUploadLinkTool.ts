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

export class CreateUploadLinkTool implements McpToolPort<CreateUploadLinkInput, CreateUploadLinkOutput> {
  readonly name = "create_upload_link";

  readonly title = "Create upload link";

  readonly description = [
    "Creates a one-time link to upload a reference picture to this server, so its bytes never pass through a tool call.",
    "Use it when a PNG, JPEG or WebP file sits on a machine that can send an HTTP request (for example with curl) and a public https:// URL does not exist.",
    "Do not use it when the picture already has a public https:// URL: pass that URL to generate_image.",
    "Returns uploadPath, image, expiresInSeconds and maxBytes.",
    "Send the file as the raw body of POST uploadPath on the host of this MCP server; the link is the credential, so no Authorization header is needed.",
    "For example: curl --data-binary @photo.jpg https://HOST/upload/TOKEN.",
    "The answer is JSON with the same image value: put it in the images field of generate_image.",
    "The link works once and expires in 5 minutes; the uploaded picture is kept for 15 minutes and can be used by several calls.",
    "It starts no agy run and spends no quota.",
  ].join(" ");

  readonly inputSchema = CreateUploadLinkInputSchema;

  readonly outputSchema = CreateUploadLinkOutputSchema;

  readonly annotations = { readOnlyHint: false, openWorldHint: false };

  run(_input: CreateUploadLinkInput, context: McpToolContext): Promise<McpToolRun<CreateUploadLinkOutput>> {
    const link = context.imageUploadService.createLink();
    return Promise.resolve({
      output: {
        uploadPath: UploadPathUtil.build(link.token),
        image: UploadReferenceUtil.build(link.imageId),
        expiresInSeconds: link.expiresInSeconds,
        maxBytes: ImageInputUtil.MAX_IMAGE_BYTES,
      },
      extraContent: [],
    });
  }

  summarize(output: CreateUploadLinkOutput): string {
    return `Upload the file with POST ${output.uploadPath}, then pass ${output.image} in the images field of generate_image.`;
  }
}
