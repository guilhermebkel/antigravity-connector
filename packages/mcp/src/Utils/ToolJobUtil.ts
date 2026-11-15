import type { McpToolContext, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { ToolJob, ToolJobKind, ToolJobOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";

type DoneSummary = (output: ToolJobOutput) => string;

export class ToolJobUtil {
  static readonly KIND_TO_DONE_SUMMARY: Readonly<Record<ToolJobKind, DoneSummary>> = {
    image: (output) => `Generated a PNG image of ${output.sizeBytes ?? 0} bytes in ${output.durationMs ?? 0} ms.`,
    web_search: (output) => {
      const sourceCount = output.sources?.length ?? 0;
      if (sourceCount === 0) {
        return "Answered from the web. The answer has no URL, so sources is empty.";
      }
      return `Answered from the web with ${sourceCount} source link(s) in ${output.durationMs ?? 0} ms.`;
    },
    research: (output) => {
      const sourceCount = output.sources?.length ?? 0;
      const truncation = output.truncated === true ? " The report was truncated." : "";
      return `Wrote a research report with ${sourceCount} source link(s) in ${output.durationMs ?? 0} ms.${truncation}`;
    },
    browse: (output) => {
      const screenshot = output.hasScreenshot === true ? " with a screenshot" : "";
      return `Browsed the page in ${output.durationMs ?? 0} ms${screenshot}.`;
    },
  };

  static buildRun(job: ToolJob, retryAfterSeconds: number): McpToolRun<ToolJobOutput> {
    if (job.state === "failed") {
      // Why: the stored error is the agy or limit error, so McpErrorUtil names the same cause a synchronous call would.
      throw job.error ?? new Error("the job failed");
    }
    if (job.run === undefined) {
      return {
        output: { status: "running", kind: job.kind, jobId: job.id, retryAfterSeconds },
        extraContent: [],
      };
    }
    return {
      output: { ...job.run.output, status: "done", kind: job.kind, jobId: job.id },
      extraContent: job.run.extraContent,
    };
  }

  static buildWithSignal(context: McpToolContext, signal: AbortSignal): McpToolContext {
    // Why: the run takes the job's own signal, not the request's, so it outlives the request; the progress observer stays, and it is closed when the request ends.
    return { ...context, signal };
  }

  static summarize(output: ToolJobOutput): string {
    if (output.status === "running") {
      return `The call is still running. Call get_result with job_id ${output.jobId} after ${output.retryAfterSeconds ?? 0} seconds.`;
    }
    return ToolJobUtil.KIND_TO_DONE_SUMMARY[output.kind](output);
  }
}
