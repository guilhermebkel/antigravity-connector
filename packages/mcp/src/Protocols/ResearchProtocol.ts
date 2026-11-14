import type { ModelId } from "@antigravity-connector/protocol";
import type { WebSearchSource } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";

export type ResearchInput = {
  topic: string;
  model?: ModelId;
};

export type ResearchOutput = {
  report: string;
  truncated: boolean;
  sources: WebSearchSource[];
  model: string;
  durationMs: number;
  totalTokens: number;
};
