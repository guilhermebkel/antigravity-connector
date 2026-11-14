import type { AgyRunService } from "@antigravity-connector/core";
import { RunIncompleteError } from "@antigravity-connector/core";
import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
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

  async run(input: WebSearchInput, context: McpToolContext): Promise<McpToolRun<WebSearchOutput>> {
    const model = input.model ?? WebSearchTool.DEFAULT_MODEL;
    const envelope = await WebSearchTool.readEnvelope(context.runService, input, model, context);
    const answer = envelope.response;
    return {
      output: {
        answer,
        model,
        sources: SourceUtil.extract(answer),
        durationMs: Math.round((envelope.duration_seconds ?? 0) * WebSearchTool.MS_PER_SECOND),
        totalTokens: envelope.usage.total_tokens,
      },
      extraContent: [],
    };
  }

  static async readEnvelope(
    runService: AgyRunService,
    input: WebSearchInput,
    model: string,
    context: McpToolContext,
  ): Promise<{
    response: string; duration_seconds?: number; usage: { total_tokens: number };
  }> {
    const events = runService.stream(
      "search",
      { model, door: "mcp", messages: [{ role: "user", content: input.query }] },
      context.signal,
      context.observer,
    );
    for await (const event of events) {
      if (event.kind === "finished") {
        return event.envelope;
      }
    }
    throw new RunIncompleteError();
  }

  summarize(output: WebSearchOutput): string {
    if (output.sources.length === 0) {
      return "Answered from the web. The answer has no URL, so sources is empty.";
    }
    return `Answered from the web with ${output.sources.length} source link(s) in ${output.durationMs} ms.`;
  }
}
