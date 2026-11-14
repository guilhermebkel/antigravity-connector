import type { McpToolContext, McpToolPort } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { WebSearchInput, WebSearchOutput } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";
import { WebSearchInputSchema, WebSearchOutputSchema } from "@antigravity-connector/mcp/Schemas/WebSearchSchema.ts";
import { SourceUtil } from "@antigravity-connector/mcp/Utils/SourceUtil.ts";

export class WebSearchTool implements McpToolPort<WebSearchInput, WebSearchOutput> {
  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  static readonly MS_PER_SECOND = 1000;

  readonly name = "web_search";

  readonly title = "Web search";

  readonly description = [
    "Searches the web with Gemini and returns a summarized answer, with links that Gemini wrote, not a raw list of results.",
    "Use it for questions that need current information from the web.",
    "Do not use it for questions the model can answer alone.",
    "Returns an answer and sources; sources is empty when the answer has no link.",
    "A call takes about 20 to 45 seconds and counts against the daily search limit.",
  ].join(" ");

  readonly inputSchema = WebSearchInputSchema;

  readonly outputSchema = WebSearchOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: true };

  async run(input: WebSearchInput, context: McpToolContext): Promise<WebSearchOutput> {
    const model = input.model ?? WebSearchTool.DEFAULT_MODEL;
    const result = await context.runService.run(
      "search",
      { model, door: "mcp", messages: [{ role: "user", content: input.query }] },
      context.signal,
    );
    const answer = result.envelope.response;
    return {
      answer,
      model,
      sources: SourceUtil.extract(answer),
      durationMs: Math.round((result.envelope.duration_seconds ?? 0) * WebSearchTool.MS_PER_SECOND),
      totalTokens: result.envelope.usage.total_tokens,
    };
  }

  summarize(output: WebSearchOutput): string {
    if (output.sources.length === 0) {
      return "Answered from the web. The answer has no URL, so sources is empty.";
    }
    return `Answered from the web with ${output.sources.length} source link(s) in ${output.durationMs} ms.`;
  }
}
