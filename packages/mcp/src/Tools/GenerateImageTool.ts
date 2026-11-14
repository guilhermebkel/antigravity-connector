import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { GenerateImageInput, GenerateImageOutput } from "@antigravity-connector/mcp/Protocols/GenerateImageProtocol.ts";
import { GenerateImageInputSchema, GenerateImageOutputSchema } from "@antigravity-connector/mcp/Schemas/GenerateImageSchema.ts";

export class GenerateImageTool implements McpToolPort<GenerateImageInput, GenerateImageOutput> {
  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  readonly name = "generate_image";

  readonly title = "Generate image";

  readonly description = [
    "Generates one PNG image from a text prompt with agy's image generator.",
    "Use it when the user asks for a picture, not for text.",
    "Do not use it to describe an existing image.",
    "Returns the image and its size.",
    "A call takes about a minute and spends subscription quota; it counts against the daily image limit.",
  ].join(" ");

  readonly inputSchema = GenerateImageInputSchema;

  readonly outputSchema = GenerateImageOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: false };

  async run(input: GenerateImageInput, context: McpToolContext): Promise<McpToolRun<GenerateImageOutput>> {
    const model = input.model ?? GenerateImageTool.DEFAULT_MODEL;
    const outcome = await context.imageService.generate(
      { model, door: "mcp", prompt: input.prompt },
      context.signal,
      context.observer,
    );
    return {
      output: {
        model,
        mimeType: "image/png",
        sizeBytes: outcome.bytes.byteLength,
        durationMs: outcome.durationMs,
        totalTokens: outcome.totalTokens,
      },
      extraContent: [{
        type: "image",
        mimeType: "image/png",
        data: Buffer.from(outcome.bytes).toString("base64"),
      }],
    };
  }

  summarize(output: GenerateImageOutput): string {
    return `Generated a PNG image of ${output.sizeBytes} bytes in ${output.durationMs} ms.`;
  }
}
