import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { WebSearchInput } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";
import type { ToolJobOutput, ToolRunOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";
import { WebSearchInputSchema } from "@antigravity-connector/mcp/Schemas/WebSearchSchema.ts";
import { ToolJobOutputSchema } from "@antigravity-connector/mcp/Schemas/ToolJobSchema.ts";
import { SourceUtil } from "@antigravity-connector/mcp/Utils/SourceUtil.ts";
import { RunEnvelopeUtil } from "@antigravity-connector/mcp/Utils/RunEnvelopeUtil.ts";
import { ToolJobUtil } from "@antigravity-connector/mcp/Utils/ToolJobUtil.ts";

export class WebSearchTool implements McpToolPort<WebSearchInput, ToolJobOutput> {
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
    "If it is not done within about 20 seconds, returns status running and a job_id: call get_result with that job_id after retry_after_seconds.",
  ].join(" ");

  readonly inputSchema = WebSearchInputSchema;

  readonly outputSchema = ToolJobOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: true };

  async run(input: WebSearchInput, context: McpToolContext): Promise<McpToolRun<ToolJobOutput>> {
    const job = context.toolJobs.start("web_search", (signal) => this.execute(input, ToolJobUtil.buildWithSignal(context, signal)));
    await context.toolJobs.waitUpTo(job, context.signal);
    return ToolJobUtil.buildRun(job, context.toolJobs.retryAfterSeconds);
  }

  async execute(input: WebSearchInput, context: McpToolContext): Promise<McpToolRun<ToolRunOutput>> {
    const model = input.model ?? WebSearchTool.DEFAULT_MODEL;
    const envelope = await RunEnvelopeUtil.read(
      context.runService,
      { kind: "search", source: this.name, text: input.query, model },
      context,
    );
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

  summarize(output: ToolJobOutput): string {
    return ToolJobUtil.summarize(output);
  }
}
