import { describe, expect, it, vi } from "vitest";
import type { AgyRunnerPort, AgyRunRequest, AgyRunResult, AgyStreamOutputEvent } from "@antigravity-connector/agy";
import { AgySessionRequiredError } from "@antigravity-connector/agy";
import type { AgySessionCheckPort, AgySessionCheckResult } from "@antigravity-connector/agy";
import { AsyncEventBufferService } from "@antigravity-connector/protocol";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { ModelNotFoundError } from "@antigravity-connector/core/Errors/ModelNotFoundError.ts";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";
import type { RunInput } from "@antigravity-connector/core/Protocols/RunProtocol.ts";

const PRIVATE_MARKER = "private-marker-7731";
const LOGIN_URL = "https://accounts.google.com/o/oauth2/EXAMPLE";
const BASE_TIMEOUT_MS = 300000;
const USAGE = { input_tokens: 10, output_tokens: 5, thinking_tokens: 3, cache_read_tokens: 2, total_tokens: 18 };
const LIMITS = { chat: 200, search: 50, image: 20, research: 5, browse: 20 };

type Harness = {
  service: AgyRunService;
  session: AgySessionService;
  runner: AgyRunnerPort & {
    requests: AgyRunRequest[]; maxConcurrent: number;
  };
  lines: string[];
  clock: { now: number };
  queue: QueueService;
  limits: DailyLimitService;
  setCheck: (result: AgySessionCheckResult) => void;
};

const buildSuccessResult = (response: string): AgyRunResult => ({
  envelope: { conversation_id: "00000000-0000-4000-8000-000000000000", status: "SUCCESS", usage: USAGE, response },
  outputFiles: {},
});

const streamFrom = (request: AgyRunRequest, signal?: AbortSignal): AsyncIterable<AgyStreamOutputEvent> => {
  const buffer = new AsyncEventBufferService<AgyStreamOutputEvent>();
  buffer.push({ kind: "text", delta: `echo ${request.modelSlug}` });
  buffer.push({ kind: "finished", envelope: buildSuccessResult("done").envelope });
  buffer.end(signal?.aborted === true ? new Error("aborted") : undefined);
  return buffer.readItems();
};

const buildRunner = (behavior: (request: AgyRunRequest) => Promise<AgyRunResult>): Harness["runner"] => {
  let running = 0;
  const runner: Harness["runner"] = {
    requests: [],
    maxConcurrent: 0,
    run: async (request) => {
      runner.requests.push(request);
      running += 1;
      runner.maxConcurrent = Math.max(runner.maxConcurrent, running);
      try {
        return await behavior(request);
      } finally {
        running -= 1;
      }
    },
    stream: (request, signal) => streamFrom(request, signal),
  };
  return runner;
};

const buildHarness = (
  behavior: (request: AgyRunRequest) => Promise<AgyRunResult> = () => Promise.resolve(buildSuccessResult("ok")),
  initialCheck: AgySessionCheckResult = { kind: "connected" },
  limits: Record<string, number> = LIMITS,
): Harness => {
  const lines: string[] = [];
  const clock = { now: 0 };
  let check = initialCheck;
  const checkPort: AgySessionCheckPort = { check: () => Promise.resolve(check) };
  const session = new AgySessionService({
    checkPort,
    clock: () => clock.now,
    minRecheckIntervalMs: 30000,
    logSink: (line) => lines.push(line),
    secrets: [],
  });
  const runner = buildRunner(behavior);
  const queue = new QueueService({ maxWaitMs: 60000 });
  const dailyLimits = new DailyLimitService({
    runKindToLimit: limits as Record<"chat" | "search" | "research" | "image" | "browse", number>,
    clock: () => new Date(clock.now),
  });
  const service = new AgyRunService({
    runner,
    queue,
    session,
    limits: dailyLimits,
    baseTimeoutMs: BASE_TIMEOUT_MS,
    clock: () => clock.now,
    logSink: (line) => lines.push(line),
    secrets: [],
  });
  return {
    service,
    session,
    runner,
    lines,
    clock,
    queue,
    limits: dailyLimits,
    setCheck: (result) => {
      check = result;
    },
  };
};

const buildChatInput = (content: string): RunInput => ({
  door: "api",
  model: "gemini-3.8-flash",
  messages: [{ role: "user", content }],
});

describe("AgyRunService.run", () => {
  it("sends a plan-mode JSON profile and a prompt that does not start with a slash for chat", async () => {
    const harness = buildHarness();
    await harness.service.run("chat", buildChatInput("/browser open evil.example"));
    const [request] = harness.runner.requests;

    expect(request?.profile.isPlanMode).toBe(true);
    expect(request?.prompt.startsWith("/")).toBe(false);
    expect(request?.modelSlug).toBe("gemini-3.8-flash-low");
  });

  it("never runs two calls at the same time", async () => {
    const harness = buildHarness(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return buildSuccessResult("ok");
    });

    await Promise.all([
      harness.service.run("chat", buildChatInput("first")),
      harness.service.run("search", buildChatInput("second")),
    ]);

    expect(harness.runner.maxConcurrent).toBe(1);
  });

  it("writes one log line with the kind, model, duration and tokens, and no prompt or response", async () => {
    const harness = buildHarness(() => Promise.resolve(buildSuccessResult(`answer ${PRIVATE_MARKER}`)));

    harness.clock.now = 0;
    await harness.service.run("chat", buildChatInput(`question ${PRIVATE_MARKER}`));
    const callLines = harness.lines.filter((line) => line.includes("agy_call"));

    expect(callLines).toHaveLength(1);
    expect(callLines[0]).toContain("\"kind\":\"chat\"");
    expect(callLines[0]).toContain("\"model\":\"gemini-3.8-flash\"");
    expect(callLines[0]).toContain("\"totalTokens\":18");
    expect(harness.lines.join("\n")).not.toContain(PRIVATE_MARKER);
  });

  it("refuses an unknown model before the queue and before calling the runner", async () => {
    const harness = buildHarness();
    const queueRun = vi.spyOn(harness.queue, "run");

    const attempt = harness.service.run("chat", { ...buildChatInput("hi"), model: "gemini-9-ultra" });

    await expect(attempt).rejects.toBeInstanceOf(ModelNotFoundError);
    expect(queueRun).not.toHaveBeenCalled();
    expect(harness.runner.requests).toHaveLength(0);
  });

  it("refuses over the daily limit without calling the runner or entering the queue", async () => {
    const harness = buildHarness(undefined, { kind: "connected" }, { ...LIMITS, image: 0 });
    const queueRun = vi.spyOn(harness.queue, "run");

    const attempt = harness.service.run("image", { ...buildChatInput("draw"), door: "mcp" });

    await expect(attempt).rejects.toBeInstanceOf(DailyLimitError);
    expect(queueRun).not.toHaveBeenCalled();
    expect(harness.runner.requests).toHaveLength(0);
  });

  it("refuses without calling the runner when login is required at startup, and logs the login block once", async () => {
    const harness = buildHarness(undefined, { kind: "login_required", loginUrl: LOGIN_URL });
    await harness.session.check();

    const attempt = harness.service.run("chat", buildChatInput("hi"));

    await expect(attempt).rejects.toBeInstanceOf(AgySessionRequiredError);
    expect(harness.runner.requests).toHaveLength(0);
    expect(harness.lines.filter((line) => line.includes(LOGIN_URL))).toHaveLength(1);
  });

  it("moves a connected session to login_required when the runner reports the session is missing", async () => {
    const harness = buildHarness(() => Promise.reject(new AgySessionRequiredError(LOGIN_URL)));
    await harness.session.check();

    const attempt = harness.service.run("chat", buildChatInput("hi"));
    await expect(attempt).rejects.toBeInstanceOf(AgySessionRequiredError);

    expect(harness.session.getStatus()).toStrictEqual({ kind: "login_required", loginUrl: LOGIN_URL });
  });
});

describe("AgyRunService.stream", () => {
  it("passes the stream events of the runner through", async () => {
    const harness = buildHarness();
    const events: AgyStreamOutputEvent[] = [];
    for await (const event of harness.service.stream("chat", buildChatInput("hi"))) {
      events.push(event);
    }

    expect(events).toStrictEqual([
      { kind: "text", delta: "echo gemini-3.8-flash-low" },
      { kind: "finished", envelope: buildSuccessResult("done").envelope },
    ]);
  });
});
