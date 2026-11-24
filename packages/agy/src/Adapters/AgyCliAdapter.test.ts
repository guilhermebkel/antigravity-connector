import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyCliAdapter } from "@antigravity-connector/agy/Adapters/AgyCliAdapter.ts";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgySessionRequiredError } from "@antigravity-connector/agy/Errors/AgySessionRequiredError.ts";
import { AgyTimeoutError } from "@antigravity-connector/agy/Errors/AgyTimeoutError.ts";
import { AgyAbortedError } from "@antigravity-connector/agy/Errors/AgyAbortedError.ts";
import type {
  AgyEnvNameToValue,
  AgyOutputWatchTiming,
  AgyRunProfile,
  AgyRunRequest,
  AgyActivityEvent,
  AgyFinishedEvent,
  AgyStartedEvent,
  AgyStreamOutputEvent,
  AgyTextEvent,
} from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

const FAKE_BINARY = resolve(import.meta.dirname, "../Testing/FakeAgy.mjs");
const CHAT_FIXTURE = resolve(import.meta.dirname, "../Testing/fixtures/chatEnvelope.json");
const FAKE_API_KEY = "test-api-key-0123456789abcdef";
const FAKE_SECRET = "sk-fake-secret-123";
const DEFAULT_TIMEOUT_MS = 20000;
const SLOW_TIMEOUT_MS = 300;
const PID_PATTERN = /fake-agy-pid=(\d+)/;
const OUTPUT_FILE_NAME = "red_circle.png";
const CHAT_PROFILE: AgyRunProfile = {
  isPlanMode: true,
  shouldSkipPermissions: false,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  expectedOutputFileNames: [],
};

let tempRoot = "";

const buildParentEnv = (extra: AgyEnvNameToValue = {}): AgyEnvNameToValue => ({
  PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
  HOME: tempRoot,
  LANG: "C.UTF-8",
  ...extra,
});

const buildAdapter = (extraEnv: AgyEnvNameToValue = {}): AgyCliAdapter =>
  new AgyCliAdapter({ binaryPath: FAKE_BINARY, parentEnv: buildParentEnv(extraEnv), tempRoot });

const buildRequest = (prompt: string, profile: Partial<AgyRunProfile> = {}): AgyRunRequest => ({
  modelSlug: "gemini-3.8-flash-low",
  profile: { ...CHAT_PROFILE, ...profile },
  prompt,
});

const captureFailure = async (run: Promise<unknown>): Promise<unknown> => {
  const outcome = await run.then(
    () => new Error("the run unexpectedly succeeded"),
    (error: unknown) => error,
  );
  return outcome;
};

const failRun = (prompt: string, profile: Partial<AgyRunProfile> = {}): Promise<unknown> => {
  const request = buildRequest(prompt, profile);
  const run = buildAdapter().run(request);
  return captureFailure(run);
};

const runPrompt = (prompt: string, profile: Partial<AgyRunProfile> = {}): ReturnType<AgyCliAdapter["run"]> => {
  const request = buildRequest(prompt, profile);
  return buildAdapter().run(request);
};

const readErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "");

const readTimeoutStderr = (error: unknown): string => (error instanceof AgyTimeoutError ? error.stderrExcerpt : "");

const readLoginUrl = (error: unknown): string | undefined =>
  error instanceof AgySessionRequiredError ? error.loginUrl : undefined;

beforeEach(() => {
  const prefix = join(tmpdir(), "agy-adapter-test-");
  tempRoot = mkdtempSync(prefix);
  chmodSync(FAKE_BINARY, 0o755);
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("AgyCliAdapter.run", () => {
  it("resolves with the envelope recorded in the fixture", async () => {
    const result = await runPrompt("[[fake-agy:success]] hi");
    const fixture = JSON.parse(readFileSync(CHAT_FIXTURE, "utf8")) as { response: string };

    expect(result.envelope.response).toBe("Pong! How can I help you today?\n");
    expect(result.envelope.response).toBe(fixture.response);
    expect(result.envelope.usage).toStrictEqual({
      input_tokens: 9420,
      output_tokens: 13,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 9433,
    });
  });

  it("removes its temporary directory after a successful run", async () => {
    await runPrompt("[[fake-agy:success]] hi");
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });

  it("removes its temporary directory after a failed run", async () => {
    await failRun("[[fake-agy:error]] hi");
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });

  it("rejects with AgyTimeoutError and leaves no child process running", async () => {
    const error = await failRun("[[fake-agy:slow]] hi", { timeoutMs: SLOW_TIMEOUT_MS });
    const pid = Number(PID_PATTERN.exec(readTimeoutStderr(error))?.[1]);

    expect(error).toBeInstanceOf(AgyTimeoutError);
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow("ESRCH");
  });

  it("rejects with AgySessionRequiredError carrying the login URL when there is no session", async () => {
    const error = await failRun("[[fake-agy:no-session]] hi");

    expect(error).toBeInstanceOf(AgySessionRequiredError);
    expect(readLoginUrl(error)).toBe("https://accounts.google.com/o/oauth2/EXAMPLE");
  });

  it("returns the bytes of the output file the run wrote", async () => {
    const result = await runPrompt("[[fake-agy:write-file]] draw", { expectedOutputFileNames: [OUTPUT_FILE_NAME] });
    const bytes = result.outputFiles[OUTPUT_FILE_NAME];

    expect(new TextDecoder().decode(bytes)).toBe("FAKE-PNG");
  });

  it("returns the envelope without the file when an expected output file is missing, so the caller can read agy's answer", async () => {
    const result = await runPrompt("[[fake-agy:success]] draw", { expectedOutputFileNames: [OUTPUT_FILE_NAME] });

    expect(result.outputFiles[OUTPUT_FILE_NAME]).toBeUndefined();
    expect(result.envelope.status).toBe("SUCCESS");
  });

  it("passes the prompt to the binary byte for byte, as one argument", async () => {
    const prompt = "[[fake-agy:echo]] say \"hi\"\nline two with `backticks` and $(rm -rf x) and 'quotes'";

    const result = await runPrompt(prompt);

    expect(result.envelope.response).toBe(prompt);
  });

  it("does not pass the API key to the child environment", async () => {
    const adapter = buildAdapter({ API_KEY: FAKE_API_KEY });
    const request = buildRequest("[[fake-agy:env]] list");

    const result = await adapter.run(request);
    const names = JSON.parse(result.envelope.response) as string[];

    expect(names).toStrictEqual(["HOME", "LANG", "PATH"]);
  });

  it("does not put a planted secret from stderr into the error message", async () => {
    const error = await failRun("[[fake-agy:stderr-secret]] hi");
    const message = readErrorMessage(error);

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(message).toContain("[redacted]");
    expect(message).not.toContain(FAKE_SECRET);
  });

  it("rejects with AgyOutputError when stdout is not an envelope", async () => {
    const error = await failRun("[[fake-agy:invalid]] hi");

    expect(error).toBeInstanceOf(AgyOutputError);
  });
});

const STREAM_CLOSED_MESSAGE = "the stream unexpectedly completed";
const STREAM_TIMEOUT_MS = 5000;
const STREAM_SLOW_PROMPT = "[[fake-agy:stream-slow]] hi";
const STREAM_SLOW_TIMEOUT_MS = 300;

const collectUntil = async (
  events: AsyncIterable<AgyStreamOutputEvent>,
  shouldStop: (event: AgyStreamOutputEvent) => boolean,
): Promise<AgyStreamOutputEvent[]> => {
  const collected: AgyStreamOutputEvent[] = [];
  for await (const event of events) {
    collected.push(event);
    if (shouldStop(event)) {
      break;
    }
  }
  return collected;
};

const collectEvents = async (events: AsyncIterable<AgyStreamOutputEvent>): Promise<AgyStreamOutputEvent[]> => {
  const collected: AgyStreamOutputEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

const captureStreamFailure = async (events: AsyncIterable<AgyStreamOutputEvent>): Promise<unknown> => {
  const outcome = await collectEvents(events).then(
    () => new Error(STREAM_CLOSED_MESSAGE),
    (error: unknown) => error,
  );
  return outcome;
};

const isTextEvent = (event: AgyStreamOutputEvent): event is AgyTextEvent => event.kind === "text";

const isFinishedEvent = (event: AgyStreamOutputEvent): event is AgyFinishedEvent => event.kind === "finished";

const isActivityEvent = (event: AgyStreamOutputEvent): event is AgyActivityEvent => event.kind === "activity";

const isStartedEvent = (event: AgyStreamOutputEvent): event is AgyStartedEvent => event.kind === "started";

const joinTextDeltas = (events: readonly AgyStreamOutputEvent[]): string =>
  events.filter(isTextEvent).map((event) => event.delta).join("");

const streamWith = (prompt: string, profile: Partial<AgyRunProfile> = {}): AsyncIterable<AgyStreamOutputEvent> => {
  const adapter = buildAdapter();
  return adapter.stream(buildRequest(prompt, { timeoutMs: STREAM_TIMEOUT_MS, ...profile }));
};

describe("AgyCliAdapter.stream", () => {
  it("yields text deltas whose concatenation is the final response", async () => {
    const events = await collectEvents(streamWith("[[fake-agy:stream-chat]] hi"));
    const finished = events.find(isFinishedEvent);

    expect(joinTextDeltas(events)).toBe("hello\n");
    expect(finished?.envelope.response).toBe("hello\n");
  });

  it("produces activity events for the tool steps of a search stream without throwing", async () => {
    const events = await collectEvents(streamWith("[[fake-agy:stream-search]] search"));
    const activities = events.filter(isActivityEvent);

    expect(activities).toHaveLength(3);
    expect(events.at(-1)?.kind).toBe("finished");
  });

  it("stops the process and removes the directory when the consumer stops after the first delta", async () => {
    const events = streamWith(STREAM_SLOW_PROMPT, { timeoutMs: STREAM_SLOW_TIMEOUT_MS });
    await collectUntil(events, isTextEvent);
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });

  it("stops the process when the abort signal fires after the first delta", async () => {
    const controller = new AbortController();
    const adapter = buildAdapter();
    const events = adapter.stream(
      buildRequest(STREAM_SLOW_PROMPT, { timeoutMs: STREAM_TIMEOUT_MS }),
      controller.signal,
    );
    const abortOnText = (event: AgyStreamOutputEvent): boolean => {
      if (isTextEvent(event)) {
        controller.abort(new Error("caller left"));
      }
      return false;
    };
    const failure = collectUntil(events, abortOnText).then(
      () => new Error(STREAM_CLOSED_MESSAGE),
      (error: unknown) => error,
    );
    const outcome = await failure;
    const remaining = readdirSync(tempRoot);

    expect(outcome).toStrictEqual(new Error("caller left"));
    expect(remaining).toStrictEqual([]);
  });

  it("parses a stream whose lines arrive in pieces", async () => {
    const events = await collectEvents(streamWith("[[fake-agy:stream-split]] hi"));
    const started = events.filter(isStartedEvent);

    expect(joinTextDeltas(events)).toBe("hello\n");
    expect(started).toHaveLength(1);
  });

  it("rejects with AgyOutputError when the stream ends without a result", async () => {
    const error = await captureStreamFailure(streamWith("[[fake-agy:stream-no-result]] hi"));

    expect(error).toBeInstanceOf(AgyOutputError);
  });

  it("yields the deltas already received, then rejects with AgyFailedError for an error status", async () => {
    const collected: AgyStreamOutputEvent[] = [];
    const consume = async (): Promise<void> => {
      for await (const event of streamWith("[[fake-agy:stream-error-status]] hi")) {
        collected.push(event);
      }
    };
    const error = await consume().then(
      () => new Error(STREAM_CLOSED_MESSAGE),
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(joinTextDeltas(collected)).toBe("hello\n");
  });

  it("rejects with AgyFailedError carrying stderr when the process fails mid-stream", async () => {
    const error = await captureStreamFailure(streamWith("[[fake-agy:stream-fail-midway]] hi"));

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(readErrorMessage(error)).toContain("boom: the stream broke");
  });

  it("rejects with AgyTimeoutError and stops the process when the stream hangs", async () => {
    const error = await captureStreamFailure(
      streamWith(STREAM_SLOW_PROMPT, { timeoutMs: STREAM_SLOW_TIMEOUT_MS }),
    );

    expect(error).toBeInstanceOf(AgyTimeoutError);
  });

  it("rejects with AgySessionRequiredError when the stream asks to log in", async () => {
    const error = await captureStreamFailure(streamWith("[[fake-agy:stream-no-session]] hi"));

    expect(error).toBeInstanceOf(AgySessionRequiredError);
  });

  it("removes its temporary directory after a successful stream", async () => {
    await collectEvents(streamWith("[[fake-agy:stream-chat]] hi"));
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });
});

type InputFile = {
  name: string;
  size: number;
  head: string;
};

type InputReport = {
  files: InputFile[];
  schema: string;
};

describe("AgyCliAdapter inputs", () => {
  const PNG_HEX = "89504e470d0a1a0a0000000d";

  it("AC1: an attachment is in the working directory during the run and gone afterwards, and the schema is passed as a file", async () => {
    const request: AgyRunRequest = {
      ...buildRequest("[[fake-agy:stream-files]] describe"),
      attachments: [{ fileName: "attachment-1.png", bytes: new Uint8Array(Buffer.from(PNG_HEX, "hex")) }],
      jsonSchema: "{\"type\":\"object\"}",
    };

    const events = await collectEvents(buildAdapter().stream(request));
    const finished = events.find((event): event is AgyFinishedEvent => event.kind === "finished");
    const report = JSON.parse(finished?.envelope.response ?? "{}") as InputReport;

    expect(report.files).toStrictEqual([
      expect.objectContaining({ name: "attachment-1.png", size: PNG_HEX.length / 2, head: PNG_HEX.slice(0, 16) }),
      expect.objectContaining({ name: "schema.json" }),
    ]);
    expect(report.schema).toBe("{\"type\":\"object\"}");
    expect(readdirSync(tempRoot).filter((name) => name.startsWith("agy-run-"))).toStrictEqual([]);
  });
});

describe("AgyCliAdapter output watching", () => {
  const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const WATCH_PROFILE: Partial<AgyRunProfile> = {
    isPlanMode: false,
    expectedOutputFileNames: ["output.png"],
    shouldWaitForOutputFiles: true,
  };
  const FAST_TIMING: AgyOutputWatchTiming = {
    pollMs: 20,
    resultGraceMs: 200,
    afterResultWaitMs: 1500,
    stopDelayMs: 500,
  };
  const SHORT_WAIT_TIMING: AgyOutputWatchTiming = { ...FAST_TIMING, afterResultWaitMs: 150 };
  const HANG_TIMEOUT_MS = 400;

  const buildWatchAdapter = (timing: AgyOutputWatchTiming = FAST_TIMING): AgyCliAdapter =>
    new AgyCliAdapter({
      tempRoot,
      binaryPath: FAKE_BINARY,
      parentEnv: buildParentEnv(),
      outputWatchTiming: timing,
    });

  const runWatched = (
    prompt: string,
    timing: AgyOutputWatchTiming = FAST_TIMING,
    profile: Partial<AgyRunProfile> = {},
  ): ReturnType<AgyCliAdapter["run"]> => {
    const request = buildRequest(prompt, { ...WATCH_PROFILE, ...profile });
    return buildWatchAdapter(timing).run(request);
  };

  const readBytes = (result: Awaited<ReturnType<typeof runWatched>>): Buffer | undefined => {
    const bytes = result.outputFiles["output.png"];
    return bytes === undefined ? undefined : Buffer.from(bytes);
  };

  it("returns the file and the result when the file is written before the result", async () => {
    const result = await runWatched("[[fake-agy:watch-file]] draw");

    expect(readBytes(result)?.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);
    expect(result.envelope.status).toBe("SUCCESS");
  });

  it("waits for a file that appears after the result while the process stays alive", async () => {
    const result = await runWatched("[[fake-agy:watch-late-file]] draw");

    expect(readBytes(result)?.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);
    expect(result.envelope.response).toBe("ok");
  });

  it("does not take a half-written PNG", async () => {
    const result = await runWatched("[[fake-agy:watch-partial-file]] draw");

    expect(readBytes(result)?.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);
  });

  it("returns agy's answer without the file when no file appears after the result and the wait ends", async () => {
    const result = await runWatched("[[fake-agy:watch-no-file]] draw", SHORT_WAIT_TIMING);

    expect(result.outputFiles["output.png"]).toBeUndefined();
    expect(result.envelope.response).toContain("I will notify you");
  });

  it("settles with an empty result when the file is ready and no result event comes", async () => {
    const result = await runWatched("[[fake-agy:watch-file-no-result]] draw");

    expect(readBytes(result)?.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);
    expect(result.envelope).toMatchObject({ status: "SUCCESS", response: "" });
  });

  it("returns a file that is not a PNG as written, after the wait", async () => {
    const result = await runWatched("[[fake-agy:watch-not-png]] draw", SHORT_WAIT_TIMING);

    expect(readBytes(result)?.toString("utf8")).toBe("not a png");
  });

  it("fails with AgyFailedError when the result carries an error status", async () => {
    const error = await captureFailure(runWatched("[[fake-agy:watch-error-result]] draw"));

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(error).toMatchObject({ envelopeStatus: "ERROR", envelopeError: "the image model failed" });
  });

  it("fails with AgyOutputError when the process exits without a result", async () => {
    const error = await captureFailure(runWatched("[[fake-agy:watch-exit-without-result]] draw"));

    expect(error).toBeInstanceOf(AgyOutputError);
  });

  it("fails with AgyFailedError when the process exits with an error code", async () => {
    const error = await captureFailure(runWatched("[[fake-agy:watch-fail-exit]] draw"));

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(readErrorMessage(error)).toContain("boom: the run broke");
  });

  it("stops a run that hangs at the timeout", async () => {
    const run = runWatched("[[fake-agy:watch-hang]] draw", FAST_TIMING, { timeoutMs: HANG_TIMEOUT_MS });
    const error = await captureFailure(run);

    expect(error).toBeInstanceOf(AgyTimeoutError);
    expect((error as AgyTimeoutError).lastActivity?.step).toBe("subagent ACTIVE");
  });

  it("fails with AgyAbortedError when the caller aborts a run that hangs", async () => {
    const controller = new AbortController();
    const run = buildWatchAdapter().run(buildRequest("[[fake-agy:watch-hang]] draw", WATCH_PROFILE), controller.signal);
    setTimeout(() => {
      controller.abort();
    }, 100);

    expect(await captureFailure(run)).toBeInstanceOf(AgyAbortedError);
  });

  it("sends the prompt over stdin and never in the arguments", async () => {
    const result = await runWatched("[[fake-agy:watch-argv]] secret-marker-4471");
    const argv = JSON.parse(result.envelope.response) as string[];

    expect(argv).toContain("--input-format");
    expect(argv).toContain("-p=");
    expect(argv.join(" ")).not.toContain("secret-marker-4471");
  });

  it("removes its temporary directory after a watched run", async () => {
    await runWatched("[[fake-agy:watch-file]] draw");

    expect(readdirSync(tempRoot)).toStrictEqual([]);
  });
});
