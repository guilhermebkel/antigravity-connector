import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgyRunResult } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyOutputWatchService } from "@antigravity-connector/agy/Services/AgyOutputWatchService.ts";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const FILE_NAME = "output.png";
const PROMPT = "private-marker-9913 draw a cat";
const TIMING = { pollMs: 20, resultGraceMs: 200, afterResultWaitMs: 500, stopDelayMs: 300 };
const TIMEOUT_MS = 5000;
const QUIET_PERIOD_MS = 120;
const SETTLE_MS = 60;
const INIT_LINE = JSON.stringify({ event: "init", conversation_id: "conversation-1", init: { cwd: "/tmp", tools: [] } });
const RESULT_LINE = JSON.stringify({
  event: "result",
  result: {
    conversation_id: "conversation-1",
    status: "SUCCESS",
    response: "done",
    usage: { input_tokens: 1, output_tokens: 1, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 2 },
  },
});

type StubStreams = {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
};

type StubChild = ChildProcess & StubStreams;

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const buildStubChild = (): StubChild => {
  const streams: StubStreams = { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() };
  const child = Object.assign(new EventEmitter(), streams, { exitCode: null, signalCode: null, pid: 1 }) as StubChild;
  child.stdin.on("finish", () => {
    child.emit("close", 0);
  });
  return child;
};

let workingDirectory = "";

const startWatching = (child: StubChild): Promise<AgyRunResult> => {
  const watcher = new AgyOutputWatchService({
    child,
    workingDirectory,
    prompt: PROMPT,
    fileNames: [FILE_NAME],
    timeoutMs: TIMEOUT_MS,
    secrets: [],
    signal: undefined,
    timing: TIMING,
    stopProcess: () => undefined,
  });
  return watcher.watch();
};

const buildSubagentLine = (state: string): string =>
  JSON.stringify({
    event: "step_update",
    step_update: { conversation_id: "subagent", step_index: 1, step_type: "subagent", state },
  });

const writePng = (): void => {
  writeFileSync(join(workingDirectory, FILE_NAME), PNG_BYTES);
};

beforeEach(() => {
  const prefix = join(tmpdir(), "agy-watch-test-");
  workingDirectory = mkdtempSync(prefix);
});

afterEach(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
});

describe("AgyOutputWatchService", () => {
  it("writes the prompt to stdin only after agy sent its init event, so a login prompt never reads it", async () => {
    const child = buildStubChild();
    const run = startWatching(child);

    await sleep(QUIET_PERIOD_MS);
    const beforeInit: unknown = child.stdin.read();
    child.stdout.write(`${INIT_LINE}\n`);
    await sleep(SETTLE_MS);
    const chunk: unknown = child.stdin.read();
    const written = String(chunk);
    writePng();
    child.stdout.write(`${RESULT_LINE}\n`);
    const result = await run;

    expect(beforeInit).toBeNull();
    expect(JSON.parse(written)).toMatchObject({ event: "user", message: { content: PROMPT } });
    expect(Buffer.from(result.outputFiles[FILE_NAME] ?? new Uint8Array()).equals(PNG_BYTES)).toBe(true);
    expect(result.envelope.response).toBe("done");
  });

  it("sends the prompt once, even when agy repeats the init event", async () => {
    const child = buildStubChild();
    const run = startWatching(child);

    child.stdout.write(`${INIT_LINE}\n${INIT_LINE}\n`);
    await sleep(SETTLE_MS);
    const chunk: unknown = child.stdin.read();
    const written = String(chunk);
    writePng();
    child.stdout.write(`${RESULT_LINE}\n`);
    await run;

    expect(written.split("\n").filter((line) => line !== "")).toHaveLength(1);
  });

  it("reports the steps, the subagent and the file size in the trace, never the text", async () => {
    const child = buildStubChild();
    const run = startWatching(child);

    child.stdout.write(`${INIT_LINE}\n`);
    await sleep(SETTLE_MS);
    child.stdout.write(`${buildSubagentLine("ACTIVE")}\n`);
    child.stdout.write(`${buildSubagentLine("DONE")}\n`);
    writePng();
    child.stdout.write(`${RESULT_LINE}\n`);
    const result = await run;

    expect(result.trace).toMatchObject({
      stepCount: 2,
      stepSummary: "subagent ACTIVE>subagent DONE",
      subagentCount: 1,
      activeSubagentCount: 0,
      afterResultExtensions: 0,
      candidateFileBytes: PNG_BYTES.length,
    });
    expect(JSON.stringify(result.trace)).not.toContain(PROMPT);
  });
});
