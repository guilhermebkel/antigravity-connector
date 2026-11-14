import type { AgyEnvelope, AgyUsage } from "@antigravity-connector/protocol/Protocols/AgyEnvelopeProtocol.ts";

export type AgyStepType = "user_input" | "agent_response" | "tool";

export type AgyStepState = "ACTIVE" | "DONE";

export type AgyInitEvent = {
  event: "init";
  conversation_id: string;
  init: {
    cwd: string;
    tools: string[];
    permission_mode: string;
  };
};

export type AgyStepUpdate = {
  conversation_id: string;
  step_index: number;
  state: AgyStepState;
  step_type: AgyStepType;
  tool_name?: string;
  tool_info?: unknown;
  text_delta?: string;
  duration_seconds?: number;
  usage?: AgyUsage;
};

export type AgyStepUpdateEvent = {
  event: "step_update";
  step_update: AgyStepUpdate;
};

export type AgyResultEvent = {
  event: "result";
  result: AgyEnvelope;
};

export type AgyUnknownStreamEvent = { event: string };

export type AgyStreamEvent = AgyInitEvent | AgyStepUpdateEvent | AgyResultEvent | AgyUnknownStreamEvent;
