import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { GenerateImageInput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";
import type { ToolJobOutput, ToolRunOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";
import { GenerateImageInputSchema } from "@antigravity-connector/mcp/Schemas/GenerateImageSchema.ts";
import { ToolJobOutputSchema } from "@antigravity-connector/mcp/Schemas/ToolJobSchema.ts";
import { ToolJobUtil } from "@antigravity-connector/mcp/Utils/ToolJobUtil.ts";

export class GenerateImageTool implements McpToolPort<GenerateImageInput, ToolJobOutput> {
  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  readonly name = "generate_image";

  readonly title = "Generate image";

  readonly description = [
    "Generates one PNG image from a text prompt with agy's image generator.",
    "Use it when the user asks for a picture, not for text.",
    "Do not use it to describe an existing image.",
    "Optional images are reference images for the picture, to edit or copy a photo: up to 4, each an https:// URL, a base64 data: URL, or the file value that create_upload_link returned after the file was uploaded; the file is a PNG, JPEG or WebP of up to 4 MiB.",
    "Prefer an https:// URL that the server can reach: it follows up to 3 redirects and refuses private addresses. A long base64 string is easy to corrupt when copied by hand, so use create_upload_link for a local file.",
    "Returns the image and its size when it is ready within about 20 seconds.",
    "Otherwise returns status running and a job_id: call get_result with that job_id after retry_after_seconds, until it returns the image.",
    "A job takes about a minute and spends subscription quota; it counts against the daily image limit.",
  ].join(" ");

  readonly inputSchema = GenerateImageInputSchema;

  readonly outputSchema = ToolJobOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: false };

  async run(input: GenerateImageInput, context: McpToolContext): Promise<McpToolRun<ToolJobOutput>> {
    const job = context.toolJobs.start("image", (signal) => this.execute(input, ToolJobUtil.buildWithSignal(context, signal)));
    await context.toolJobs.waitUpTo(job, context.signal);
    return ToolJobUtil.buildRun(job, context.toolJobs.retryAfterSeconds);
  }

  async execute(input: GenerateImageInput, context: McpToolContext): Promise<McpToolRun<ToolRunOutput>> {
    const model = input.model ?? GenerateImageTool.DEFAULT_MODEL;
    const attachments = await context.imageSourceService.readAttachments(input.images ?? [], context.signal);
    const outcome = await context.imageService.generate(
      { model, attachments, door: "mcp", prompt: input.prompt },
      context.signal,
      context.observer,
    );
    return {
      output: {
        model,
        mimeType: outcome.mimeType,
        sizeBytes: outcome.bytes.byteLength,
        durationMs: outcome.durationMs,
        totalTokens: outcome.totalTokens,
      },
      extraContent: [{
        type: "image",
        mimeType: outcome.mimeType,
        data: Buffer.from(outcome.bytes).toString("base64"),
      }],
    };
  }

  summarize(output: ToolJobOutput): string {
    return ToolJobUtil.summarize(output);
  }
}
