import {
  AgyStreamEventSchema,
  type AgyInitEvent,
  type AgyResultEvent,
  type AgyStepUpdate,
  type AgyStepUpdateEvent,
  type AgyStreamEvent,
} from "@antigravity-connector/protocol";
import type { AgyStreamOutputEvent } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export type SubagentStep = {
  index: number;
  isActive: boolean;
};

export class AgyStreamEventUtil {
  static parseLine(line: string): AgyStreamEvent | undefined {
    const json = AgyStreamEventUtil.decodeJson(line);
    if (json === undefined) {
      return undefined;
    }
    const result = AgyStreamEventSchema.safeParse(json);
    return result.success ? result.data : undefined;
  }

  static decodeJson(line: string): unknown {
    try {
      return JSON.parse(line);
    } catch {
      return undefined;
    }
  }

  static buildOutputEvents(event: AgyStreamEvent): AgyStreamOutputEvent[] {
    if (AgyStreamEventUtil.isInit(event)) {
      return [{ kind: "started", conversationId: event.conversation_id }];
    }
    if (AgyStreamEventUtil.isStepUpdate(event)) {
      return AgyStreamEventUtil.mapStep(event.step_update);
    }
    if (AgyStreamEventUtil.isResult(event) && event.result.status === "SUCCESS") {
      return [{ kind: "finished", envelope: event.result }];
    }
    return [];
  }

  static mapStep(step: AgyStepUpdate): AgyStreamOutputEvent[] {
    if (step.step_type === "agent_response") {
      return AgyStreamEventUtil.mapResponseStep(step);
    }
    return AgyStreamEventUtil.mapToolStep(step);
  }

  static mapResponseStep(step: AgyStepUpdate): AgyStreamOutputEvent[] {
    const delta = step.text_delta;
    if (delta === undefined || delta === "") {
      return [];
    }
    return [{ kind: "text", delta }];
  }

  static mapToolStep(step: AgyStepUpdate): AgyStreamOutputEvent[] {
    if (step.step_type !== "tool" || step.state !== "ACTIVE") {
      return [];
    }
    return [{ kind: "activity", stepType: "tool" }];
  }

  static isInit(event: AgyStreamEvent): event is AgyInitEvent {
    return event.event === "init";
  }

  static isStepUpdate(event: AgyStreamEvent): event is AgyStepUpdateEvent {
    return event.event === "step_update";
  }

  static isResult(event: AgyStreamEvent): event is AgyResultEvent {
    return event.event === "result";
  }

  static readSubagentStep(line: string): SubagentStep | undefined {
    // Why: agy reports a subagent as a step with its own index; while it is ACTIVE, the picture may still be on its way.
    const json = AgyStreamEventUtil.decodeJson(line);
    if (typeof json !== "object" || json === null || !("step_update" in json)) {
      return undefined;
    }
    const step = json.step_update;
    if (typeof step !== "object" || step === null || !("step_type" in step) || step.step_type !== "subagent") {
      return undefined;
    }
    const index = "step_index" in step && typeof step.step_index === "number" ? step.step_index : undefined;
    if (index === undefined) {
      return undefined;
    }
    return { index, isActive: "state" in step && step.state === "ACTIVE" };
  }

  static readStepLabel(line: string): string | undefined {
    const json = AgyStreamEventUtil.decodeJson(line);
    if (typeof json !== "object" || json === null || !("step_update" in json)) {
      return undefined;
    }
    const step = json.step_update;
    if (typeof step !== "object" || step === null || !("step_type" in step) || typeof step.step_type !== "string") {
      return undefined;
    }
    const toolName = "tool_name" in step && typeof step.tool_name === "string" ? `:${step.tool_name}` : "";
    const state = "state" in step && typeof step.state === "string" ? ` ${step.state}` : "";
    return `${step.step_type}${toolName}${state}`;
  }
}
