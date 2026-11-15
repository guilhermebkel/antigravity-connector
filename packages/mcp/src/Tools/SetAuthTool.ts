import { AuthStatusUtil } from "@antigravity-connector/core";
import type { McpToolContext, McpToolPort, McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { AuthToolOutput, SetAuthInput } from "@antigravity-connector/mcp/Protocols/AuthToolProtocol.ts";
import { AuthToolOutputSchema, SetAuthInputSchema } from "@antigravity-connector/mcp/Schemas/AuthToolSchema.ts";

export class SetAuthTool implements McpToolPort<SetAuthInput, AuthToolOutput> {
  readonly name = "set_auth";

  readonly title = "Set auth";

  readonly description = [
    "Sends the Google authorization code from the login page to the login started by check_auth.",
    "Send only a code the owner just copied from that page; the server does not store or log it.",
    "Returns connected when the code worked, or an error when it was refused or expired (then call check_auth again).",
    "A call takes a few seconds.",
  ].join(" ");

  readonly inputSchema = SetAuthInputSchema;

  readonly outputSchema = AuthToolOutputSchema;

  readonly annotations = { readOnlyHint: false, openWorldHint: true };

  async run(input: SetAuthInput, context: McpToolContext): Promise<McpToolRun<AuthToolOutput>> {
    const status = await context.loginService.submitCode(input.code);
    return { output: AuthStatusUtil.buildResponse(status), extraContent: [] };
  }

  summarize(output: AuthToolOutput): string {
    return `agy is ${output.status}.`;
  }
}
