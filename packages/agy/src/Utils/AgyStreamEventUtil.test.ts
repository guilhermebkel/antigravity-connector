import { describe, expect, it } from "vitest";
import { AgyStreamEventUtil } from "@antigravity-connector/agy/Utils/AgyStreamEventUtil.ts";

const SESSION_ID = "00000000-0000-4000-8000-000000000000";
const USAGE = { input_tokens: 1, output_tokens: 2, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 3 };

const buildStepLine = (step: Record<string, unknown>): string =>
  JSON.stringify({ event: "step_update", step_update: { conversation_id: SESSION_ID, ...step, step_index: 1 } });

const buildResultLine = (status: string): string =>
  JSON.stringify({
    event: "result",
    result: { conversation_id: SESSION_ID, response: "done", usage: USAGE, status },
  });

describe("AgyStreamEventUtil", () => {
  it("maps the init event to started with the conversation id", () => {
    const line = JSON.stringify({ event: "init", conversation_id: SESSION_ID, init: { cwd: "/tmp", tools: [], permission_mode: "request-review" } });

    const events = AgyStreamEventUtil.buildOutputEvents(AgyStreamEventUtil.parseLine(line) ?? { event: "missing" });

    expect(events).toStrictEqual([{ kind: "started", conversationId: SESSION_ID }]);
  });

  it("maps a non-empty agent response delta to a text event", () => {
    const line = buildStepLine({ state: "ACTIVE", step_type: "agent_response", text_delta: "hello" });

    const events = AgyStreamEventUtil.buildOutputEvents(AgyStreamEventUtil.parseLine(line) ?? { event: "missing" });

    expect(events).toStrictEqual([{ kind: "text", delta: "hello" }]);
  });

  it("maps an active tool step to an activity event with only its step type", () => {
    const line = buildStepLine({ state: "ACTIVE", step_type: "tool", tool_name: "search_web", tool_info: { parameters: {} } });

    const events = AgyStreamEventUtil.buildOutputEvents(AgyStreamEventUtil.parseLine(line) ?? { event: "missing" });

    expect(events).toStrictEqual([{ kind: "activity", stepType: "tool" }]);
  });

  it("maps a successful result to finished and a failed result to nothing", () => {
    const success = AgyStreamEventUtil.parseLine(buildResultLine("SUCCESS"));
    const failed = AgyStreamEventUtil.parseLine(buildResultLine("ERROR"));

    expect(AgyStreamEventUtil.buildOutputEvents(success ?? { event: "missing" })).toStrictEqual([
      { kind: "finished", envelope: { conversation_id: SESSION_ID, response: "done", status: "SUCCESS", usage: USAGE } },
    ]);
    expect(AgyStreamEventUtil.buildOutputEvents(failed ?? { event: "missing" })).toStrictEqual([]);
  });

  it("ignores an unknown event type and an unknown step type", () => {
    const unknownEvent = AgyStreamEventUtil.parseLine(JSON.stringify({ event: "heartbeat" }));
    const unknownStep = AgyStreamEventUtil.parseLine(buildStepLine({ state: "ACTIVE", step_type: "browser_session" }));

    expect(AgyStreamEventUtil.buildOutputEvents(unknownEvent ?? { event: "missing" })).toStrictEqual([]);
    expect(AgyStreamEventUtil.buildOutputEvents(unknownStep ?? { event: "missing" })).toStrictEqual([]);
  });

  it("returns nothing for a line that is not JSON", () => {
    expect(AgyStreamEventUtil.parseLine("Authentication required")).toBeUndefined();
  });
});
