import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { GetResultInput } from "@antigravity-connector/mcp/Protocols/GetResultProtocol.ts";
import type { ToolJobOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";
import { GetResultInputSchema } from "@antigravity-connector/mcp/Schemas/GetResultSchema.ts";
import { ToolJobOutputSchema } from "@antigravity-connector/mcp/Schemas/ToolJobSchema.ts";
import { JobNotFoundError } from "@antigravity-connector/mcp/Errors/JobNotFoundError.ts";
import { ToolJobUtil } from "@antigravity-connector/mcp/Utils/ToolJobUtil.ts";

export class GetResultTool implements McpToolPort<GetResultInput, ToolJobOutput> {
  readonly name = "get_result";

  readonly title = "Get result";

  readonly description = [
    "Returns the result of a generate_image, web_search, research or browse call that was still running.",
    "Use it only with the job_id that the call returned, after retry_after_seconds.",
    "Returns the result when it is ready, or status running again when it is not yet; a call waits up to about 20 seconds.",
    "Returns an error when the job failed or has expired (jobs are kept for 10 minutes after they finish).",
    "Starts no new run and spends no quota.",
  ].join(" ");

  readonly inputSchema = GetResultInputSchema;

  readonly outputSchema = ToolJobOutputSchema;

  readonly annotations = { readOnlyHint: true, openWorldHint: false };

  async run(input: GetResultInput, context: McpToolContext): Promise<McpToolRun<ToolJobOutput>> {
    const job = context.toolJobs.get(input.job_id);
    if (job === undefined) {
      throw new JobNotFoundError();
    }
    // Why: no request signal here: a cancelled get_result must not stop the job that another call started.
    await context.toolJobs.waitUpTo(job);
    return ToolJobUtil.buildRun(job, context.toolJobs.retryAfterSeconds);
  }

  summarize(output: ToolJobOutput): string {
    return ToolJobUtil.summarize(output);
  }
}
