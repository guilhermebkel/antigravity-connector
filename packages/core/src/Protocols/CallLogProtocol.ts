import type { RunKind } from "@antigravity-connector/protocol";
import type { RunDoor } from "@antigravity-connector/core/Protocols/RunProtocol.ts";

export type CallStatus = "success" | "error" | "stopped";

export type CallRecord = {
  startedAt: string;
  door: RunDoor;
  routeOrTool: string;
  kind: RunKind;
  model: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  status: CallStatus;
};

export interface CallLogPort { write(record: CallRecord): void }
