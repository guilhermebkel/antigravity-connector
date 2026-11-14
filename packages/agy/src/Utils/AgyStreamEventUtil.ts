import {
  AgyStreamEventSchema,
  type AgyInitEvent,
  type AgyResultEvent,
  type AgyStepUpdate,
  type AgyStepUpdateEvent,
  type AgyStreamEvent,
} from "@antigravity-connector/protocol";
import type { AgyStreamOutputEvent } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

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
}
