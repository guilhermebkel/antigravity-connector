import type { OpenAiContentPart, OpenAiMessage, OpenAiRole } from "@antigravity-connector/protocol";

export class PromptUtil {
  static readonly ROLE_TO_LABEL: Readonly<Record<OpenAiRole, string>> = {
    system: "System",
    developer: "Developer",
    user: "User",
    assistant: "Assistant",
  };

  static readonly INSTRUCTION_ROLES: ReadonlySet<OpenAiRole> = new Set<OpenAiRole>(["system", "developer"]);

  static readonly IMAGE_PLACEHOLDER = "[image not included in this call]";

  static readonly SEPARATOR = "\n\n";

  static build(messages: readonly OpenAiMessage[]): string {
    const instructions = messages.filter((message) => PromptUtil.isInstruction(message));
    const turns = messages.filter((message) => !PromptUtil.isInstruction(message));
    const formatted = [...instructions, ...turns].map((message) => PromptUtil.formatMessage(message));
    return formatted.join(PromptUtil.SEPARATOR);
  }

  static isInstruction(message: OpenAiMessage): boolean {
    return PromptUtil.INSTRUCTION_ROLES.has(message.role);
  }

  static formatMessage(message: OpenAiMessage): string {
    const text = PromptUtil.readContentText(message.content);
    return `${PromptUtil.ROLE_TO_LABEL[message.role]}: ${PromptUtil.escapeSlashLines(text)}`;
  }

  static readContentText(content: string | readonly OpenAiContentPart[]): string {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => PromptUtil.readPartText(part)).join("\n");
  }

  static readPartText(part: OpenAiContentPart): string {
    if (part.type !== "text") {
      return PromptUtil.IMAGE_PLACEHOLDER;
    }
    return part.text;
  }

  static escapeSlashLines(text: string): string {
    return text
      .split("\n")
      .map((line) => (line.startsWith("/") ? `\\${line}` : line))
      .join("\n");
  }
}
