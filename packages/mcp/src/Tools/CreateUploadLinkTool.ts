import { UploadReferenceUtil } from "@antigravity-connector/core";
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
      "Creates a one-time link to upload a file to this server, so its bytes never pass through a tool call.",
      "kind says what the file is: image (a PNG, JPEG or WebP reference picture for generate_image, up to 4 MiB; the default), audio (for transcribe_audio, up to 20 MiB) or video (for analyse_video, up to 30 MiB).",
      "Use it when the file sits on a machine that can send an HTTP request (for example with curl). Audio and video always need it; a picture does not when it already has a public https:// URL: pass that URL to generate_image.",
      "Returns uploadPath, uploadUrl, kind, file, expiresInSeconds and maxBytes.",
      "Send the file as the raw body of a POST to uploadUrl; the link is the credential, so no Authorization header is needed.",
      "uploadUrl is present only when the owner set PUBLIC_URL on the server; otherwise POST uploadPath on the host of this MCP server.",
      "For example: curl --data-binary @photo.jpg \"$UPLOAD_URL\".",
      "The answer is JSON with the same file value: put it in the images field of generate_image, or in the file field of transcribe_audio or analyse_video.",
      "The link works once and expires in 5 minutes; the uploaded picture is kept for 15 minutes and can be used by several calls.",
      "It starts no agy run and spends no quota.",
    ].join(" ");
  }

  run(input: CreateUploadLinkInput, context: McpToolContext): Promise<McpToolRun<CreateUploadLinkOutput>> {
    const link = context.mediaUploadService.createLink(input.kind ?? "image");
    const uploadPath = UploadPathUtil.build(link.token);
    const uploadUrl = this.publicUrl === undefined ? {} : { uploadUrl: new URL(uploadPath, this.publicUrl).href };
    return Promise.resolve({
      output: {
        uploadPath,
        ...uploadUrl,
        kind: link.kind,
        file: UploadReferenceUtil.build(link.uploadId),
        expiresInSeconds: link.expiresInSeconds,
        maxBytes: link.maxBytes,
      },
      extraContent: [],
    });
  }

  summarize(output: CreateUploadLinkOutput): string {
    return `Upload the file with POST ${output.uploadUrl ?? output.uploadPath}, then pass ${output.file} as the file or in the images field of the tool that reads it.`;
  }
}
