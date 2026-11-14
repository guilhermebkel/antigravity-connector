import type { OpenAiMessage, ReasoningEffort } from "@antigravity-connector/protocol";

export type RunDoor = "api" | "mcp" | "internal";

export type RunInput = {
  door: RunDoor;
  model: string;
  effort?: ReasoningEffort;
  messages: readonly OpenAiMessage[];
  conversationId?: string;
  jsonSchema?: string;
};
