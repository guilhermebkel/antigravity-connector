import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { ResearchInput, ResearchOutput } from "@antigravity-connector/mcp/Protocols/ResearchProtocol.ts";
import { ResearchInputSchema, ResearchOutputSchema } from "@antigravity-connector/mcp/Schemas/ResearchSchema.ts";
import { RunEnvelopeUtil } from "@antigravity-connector/mcp/Utils/RunEnvelopeUtil.ts";
import { ReportUtil } from "@antigravity-connector/mcp/Utils/ReportUtil.ts";
import { SourceUtil } from "@antigravity-connector/mcp/Utils/SourceUtil.ts";

export type ResearchToolOptions = { dailyLimit: number };

export class ResearchTool implements McpToolPort<ResearchInput, ResearchOutput> {
  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  static readonly MS_PER_SECOND = 1000;

  readonly name = "research";

  readonly title = "Research";

  readonly description: string;

  readonly inputSchema = ResearchInputSchema;

  readonly outputSchema = ResearchOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: true };

  constructor(options: ResearchToolOptions) {
    this.description = [
      "Writes a Markdown research report on a broad topic, with a source link for each claim taken from the web.",
      "A call takes several minutes (up to 10) and spends tens of thousands of tokens of the subscription.",
      `It is limited to ${options.dailyLimit} calls per day.`,
      "For a quick question, use web_search instead.",
      `The report is capped at ${ReportUtil.MAX_CHARS} characters; truncated is true when it was cut.`,
    ].join(" ");
  }

  async run(input: ResearchInput, context: McpToolContext): Promise<McpToolRun<ResearchOutput>> {
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

  summarize(output: ResearchOutput): string {
    const truncation = output.truncated ? " The report was truncated." : "";
    return `Wrote a research report with ${output.sources.length} source link(s) in ${output.durationMs} ms.${truncation}`;
  }
}
