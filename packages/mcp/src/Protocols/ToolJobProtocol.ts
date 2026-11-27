import type { McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";

export type ToolJobState = "running" | "finished" | "failed";

export type ToolJobKind = "image" | "web_search" | "research" | "browse" | "transcribe_audio" | "analyse_video";

export type ToolJobSource = {
  title: string;
  url: string;
};

export type ToolJobOutput = {
  status: "done" | "running";
  kind: ToolJobKind;
  jobId: string;
  retryAfterSeconds?: number;
  answer?: string;
  sources?: ToolJobSource[];
  report?: string;
  truncated?: boolean;
  text?: string;
  hasScreenshot?: boolean;
  mimeType?: "image/png";
  sizeBytes?: number;
  model?: string;
  durationMs?: number;
  totalTokens?: number;
};

export type ToolRunOutput = Omit<ToolJobOutput, "status" | "kind" | "jobId" | "retryAfterSeconds">;

export type ToolJobRun = (signal: AbortSignal) => Promise<McpToolRun<ToolRunOutput>>;

export type ToolJob = {
  id: string;
  kind: ToolJobKind;
  state: ToolJobState;
  startedAtMs: number;
  finishedAtMs?: number;
  run?: McpToolRun<ToolRunOutput>;
  error?: Error;
  controller: AbortController;
  done: Promise<void>;
};
