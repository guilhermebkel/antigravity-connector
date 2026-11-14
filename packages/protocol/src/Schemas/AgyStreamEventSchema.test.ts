import { describe, expect, it } from "vitest";
import { FixtureUtil } from "@antigravity-connector/protocol/Testing/FixtureUtil.ts";
import { AgyStreamEventSchema } from "@antigravity-connector/protocol/Schemas/AgyStreamEventSchema.ts";

const parseLines = (fileName: string): unknown[] =>
  FixtureUtil.readLines(fileName).map((line) => AgyStreamEventSchema.parse(JSON.parse(line)));

const listEventNames = (events: unknown[]): unknown[] =>
  events.map((event) => (event as { event: unknown }).event);

describe("AgyStreamEventSchema", () => {
  it("parses every line of the recorded chat stream", () => {
    const events = parseLines("chatStream.ndjson");

    expect(listEventNames(events)).toStrictEqual(["init", "step_update", "step_update", "step_update", "result"]);
  });

  it("parses every line of the recorded search stream, including its six tool steps", () => {
    const events = parseLines("searchStream.ndjson");
    const toolSteps = events.filter(
      (event) => (event as { step_update?: { step_type?: unknown } }).step_update?.step_type === "tool",
    );

    expect(events).toHaveLength(18);
    expect(toolSteps).toHaveLength(6);
  });

  it("parses an event type it does not know as the fallback member", () => {
    const line = { event: "heartbeat", at: 1 };

    const result = AgyStreamEventSchema.safeParse(line);

    expect(result.data).toStrictEqual(line);
  });

  it("parses a step type it does not know as the fallback member, so the run keeps going", () => {
    const line = {
      event: "step_update",
      step_update: {
        conversation_id: "00000000-0000-4000-8000-000000000000",
        step_index: 3,
        state: "ACTIVE",
        step_type: "browser_session",
        tool_name: "open_browser_url",
      },
    };

    const result = AgyStreamEventSchema.safeParse(line);

    expect(result.data).toStrictEqual(line);
  });
});
