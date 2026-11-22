import type { OpenAiMessage, RunKind } from "@antigravity-connector/protocol";
import { PromptUtil } from "@antigravity-connector/agy";

export class RunPromptUtil {
  static readonly BROWSE_COMMAND = "/browser";

  static readonly RUN_KIND_TO_INSTRUCTION: Readonly<Record<RunKind, string>> = {
    chat: "Answer the conversation directly. Do not search the web and do not edit files.",
    search: "Answer briefly and list the source URLs you used. Use the web search tool.",
    research: "Write a Markdown report on the request, with a link to every source you used.",
    image: "Use the image-generator subagent to create exactly one PNG and save it as output.png in the current directory. Reply only after output.png exists in the current directory. Do not reply with a promise to report later.",
    browse: "",
  };

  static build(kind: RunKind, messages: readonly OpenAiMessage[], attachmentNames: readonly string[] = []): string {
    if (kind === "browse") {
      return `${RunPromptUtil.BROWSE_COMMAND} ${PromptUtil.build(messages)}`;
    }
    const instructions: OpenAiMessage[] = [{ role: "system", content: RunPromptUtil.RUN_KIND_TO_INSTRUCTION[kind] }];
    if (attachmentNames.length > 0) {
      instructions.push({ role: "system", content: RunPromptUtil.buildAttachmentInstruction(attachmentNames, kind) });
    }
    return PromptUtil.build([...instructions, ...messages]);
  }

  static buildAttachmentInstruction(attachmentNames: readonly string[], kind: RunKind = "chat"): string {
    if (kind === "image") {
      return `The user attached these reference images, saved in the current directory: ${attachmentNames.join(", ")}. Read each one with the read_file tool, then make the picture from the request, using them as the reference.`;
    }
    return `The user attached these files, saved in the current directory: ${attachmentNames.join(", ")}. Read each one with the read_file tool before you answer.`;
  }
}
