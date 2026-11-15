import { AuthStatusUtil, type AuthStatus } from "@antigravity-connector/core";
import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { AuthToolOutput, CheckAuthInput } from "@antigravity-connector/mcp/Protocols/AuthToolProtocol.ts";
import { AuthToolOutputSchema, CheckAuthInputSchema } from "@antigravity-connector/mcp/Schemas/AuthToolSchema.ts";

export class CheckAuthTool implements McpToolPort<CheckAuthInput, AuthToolOutput> {
  readonly name = "check_auth";

  readonly title = "Check auth";

  readonly description = [
    "Checks whether agy is logged in to the Google AI subscription.",
    "If it is not, returns a login_url to open in a browser; sign in, then call set_auth with the code the login page shows.",
    "The login link is valid for 60 seconds; call this again for a new one.",
    "A check takes a few seconds and sends one short model call.",
  ].join(" ");

  readonly inputSchema = CheckAuthInputSchema;

  readonly outputSchema = AuthToolOutputSchema;

  readonly annotations = { readOnlyHint: false, openWorldHint: true };

  async run(_input: CheckAuthInput, context: McpToolContext): Promise<McpToolRun<AuthToolOutput>> {
    const status: AuthStatus = await context.loginService.readStatus();
    return { output: AuthStatusUtil.buildResponse(status), extraContent: [] };
  }

  summarize(output: AuthToolOutput): string {
    return `agy is ${output.status}. Open login_url, then call set_auth with the code when the status is login_required.`;
  }
}
