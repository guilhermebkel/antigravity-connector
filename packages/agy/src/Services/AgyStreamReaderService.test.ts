import { describe, expect, it } from "vitest";
import { AsyncEventBufferService } from "@antigravity-connector/protocol";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import type { AgyStreamOutputEvent } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyStreamReaderService } from "@antigravity-connector/agy/Services/AgyStreamReaderService.ts";

const SESSION_ID = "00000000-0000-4000-8000-000000000000";
const USAGE = { input_tokens: 1, output_tokens: 2, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 3 };
const INIT_LINE = JSON.stringify({ event: "init", conversation_id: SESSION_ID, init: { cwd: "/tmp", tools: [], permission_mode: "r" } });
const DELTA_LINE = JSON.stringify({ event: "step_update", step_update: { conversation_id: SESSION_ID, step_index: 1, state: "ACTIVE", step_type: "agent_response", text_delta: "hi" } });
const buildResultLine = (status: string): string =>
  JSON.stringify({ event: "result", result: { conversation_id: SESSION_ID, response: "hi", usage: USAGE, status } });

const createReader = (): {
  reader: AgyStreamReaderService; buffer: AsyncEventBufferService<AgyStreamOutputEvent>;
} => {
  const buffer = new AsyncEventBufferService<AgyStreamOutputEvent>();
  const reader = new AgyStreamReaderService(buffer, { timeoutMs: 10000, secrets: [] });
  return { reader, buffer };
};

const readAll = async (buffer: AsyncEventBufferService<AgyStreamOutputEvent>): Promise<AgyStreamOutputEvent[]> => {
  const events: AgyStreamOutputEvent[] = [];
  for await (const event of buffer.readItems()) {
    events.push(event);
  }
  return events;
};

describe("AgyStreamReaderService", () => {
  it("parses a line split across two chunks exactly once", async () => {
    const { reader, buffer } = createReader();
    const collected = readAll(buffer);
    const middle = Math.floor(INIT_LINE.length / 2);

    reader.addStdout(INIT_LINE.slice(0, middle));
    reader.addStdout(`${INIT_LINE.slice(middle)}\n${buildResultLine("SUCCESS")}\n`);
    reader.finish(0, false);

    const events = await collected;
    expect(events.filter((event) => event.kind === "started")).toStrictEqual([
      { kind: "started", conversationId: SESSION_ID },
    ]);
  });

  it("rejects with AgyOutputError when the stream ends without a result", async () => {
    const { reader, buffer } = createReader();
    reader.addStdout(`${INIT_LINE}\n${DELTA_LINE}\n`);
    reader.finish(0, false);

    const attempt = readAll(buffer);

    await expect(attempt).rejects.toBeInstanceOf(AgyOutputError);
  });

  it("yields the deltas already received, then rejects with AgyFailedError for a non-success result", async () => {
    const { reader, buffer } = createReader();
    const seen: AgyStreamOutputEvent[] = [];
    const consume = async (): Promise<void> => {
      for await (const event of buffer.readItems()) {
        seen.push(event);
      }
    };
    const consumed = consume();
    reader.addStdout(`${DELTA_LINE}\n${buildResultLine("ERROR")}\n`);
    reader.finish(0, false);

    await expect(consumed).rejects.toBeInstanceOf(AgyFailedError);
    expect(seen).toStrictEqual([{ kind: "text", delta: "hi" }]);
  });
});
