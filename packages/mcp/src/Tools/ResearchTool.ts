import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { ResearchInput } from "@antigravity-connector/mcp/Protocols/ResearchProtocol.ts";
import type { ToolJobOutput, ToolRunOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";
import { ResearchInputSchema } from "@antigravity-connector/mcp/Schemas/ResearchSchema.ts";
import { ToolJobOutputSchema } from "@antigravity-connector/mcp/Schemas/ToolJobSchema.ts";
import { RunEnvelopeUtil } from "@antigravity-connector/mcp/Utils/RunEnvelopeUtil.ts";
import { ReportUtil } from "@antigravity-connector/mcp/Utils/ReportUtil.ts";
import { SourceUtil } from "@antigravity-connector/mcp/Utils/SourceUtil.ts";
import { ToolJobUtil } from "@antigravity-connector/mcp/Utils/ToolJobUtil.ts";

export type ResearchToolOptions = { dailyLimit: number };

export class ResearchTool implements McpToolPort<ResearchInput, ToolJobOutput> {
  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  static readonly MS_PER_SECOND = 1000;

  readonly name = "research";

  readonly title = "Research";

  readonly description: string;

  readonly inputSchema = ResearchInputSchema;

  readonly outputSchema = ToolJobOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: true };

  constructor(options: ResearchToolOptions) {
    this.description = [
      "Writes a Markdown research report on a broad topic, with a source link for each claim taken from the web.",
      "A call takes several minutes (up to 10) and spends tens of thousands of tokens of the subscription.",
      `It is limited to ${options.dailyLimit} calls per day.`,
      "For a quick question, use web_search instead.",
      `The report is capped at ${ReportUtil.MAX_CHARS} characters; truncated is true when it was cut.`,
      "It returns status running and a job_id when the report is not ready within about 20 seconds: call get_result with that job_id after retry_after_seconds, until it returns the report.",
    ].join(" ");
  }

  async run(input: ResearchInput, context: McpToolContext): Promise<McpToolRun<ToolJobOutput>> {
    const job = context.toolJobs.start("research", (signal) => this.execute(input, ToolJobUtil.buildWithSignal(context, signal)));
    await context.toolJobs.waitUpTo(job, context.signal);
    return ToolJobUtil.buildRun(job, context.toolJobs.retryAfterSeconds);
  }

  async execute(input: ResearchInput, context: McpToolContext): Promise<McpToolRun<ToolRunOutput>> {
    const model = input.model ?? ResearchTool.DEFAULT_MODEL;
    const envelope = await RunEnvelopeUtil.read(
      context.runService,
      { kind: "research", source: this.name, text: input.topic, model },
      context,
    );
    const cut = ReportUtil.truncate(envelope.response);
    return {
      output: {
        report: cut.text,
        truncated: cut.isTruncated,
        sources: SourceUtil.extract(cut.text),
        durationMs: Math.round((envelope.duration_seconds ?? 0) * ResearchTool.MS_PER_SECOND),
        totalTokens: envelope.usage.total_tokens,
        model,
      },
      extraContent: [],
    };
  }

  summarize(output: ToolJobOutput): string {
    return ToolJobUtil.summarize(output);
  }
}
