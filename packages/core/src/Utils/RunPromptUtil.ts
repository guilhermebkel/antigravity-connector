import type { OpenAiMessage, RunKind } from "@antigravity-connector/protocol";
import { PromptUtil } from "@antigravity-connector/agy";

export class RunPromptUtil {
  static readonly BROWSE_COMMAND = "/browser";

  static readonly RUN_KIND_TO_INSTRUCTION: Readonly<Record<RunKind, string>> = {
    chat: "Answer the conversation directly. Do not search the web and do not edit files.",
    search: "Answer briefly and list the source URLs you used. Use the web search tool.",
    research: "Write a Markdown report on the request, with a link to every source you used.",
    image: "Use the image-generator subagent to create exactly one PNG and save it as output.png in the current directory.",
    browse: "",
  };

  static build(kind: RunKind, messages: readonly OpenAiMessage[]): string {
    if (kind === "browse") {
      return `${RunPromptUtil.BROWSE_COMMAND} ${PromptUtil.build(messages)}`;
    }
    const instruction: OpenAiMessage = { role: "system", content: RunPromptUtil.RUN_KIND_TO_INSTRUCTION[kind] };
    return PromptUtil.build([instruction, ...messages]);
  }
}
