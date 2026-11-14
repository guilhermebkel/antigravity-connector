import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueueService } from "@antigravity-connector/core/Services/QueueService.ts";
import { QueueTimeoutError } from "@antigravity-connector/core/Errors/QueueTimeoutError.ts";

const MAX_WAIT_MS = 1000;
const FIRST_RESULT = "first";
const SECOND_RESULT = "second";
const ORDER_FIRST_START = "first start";
const ORDER_SECOND_START = "second start";
const ABORT_REASON_MESSAGE = "caller left";

type Deferred = {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
};

const createDeferred = (): Deferred => {
  let resolveDeferred: (value: string) => void = () => undefined;
  let rejectDeferred: (reason: unknown) => void = () => undefined;
  const promise = new Promise<string>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });
  return { promise, resolve: resolveDeferred, reject: rejectDeferred };
};

const settleFirstWith = (gate: Deferred, outcome: "resolves" | "rejects"): void => {
  if (outcome === "resolves") {
    gate.resolve(FIRST_RESULT);
    return;
  }
  gate.reject(new Error("first failed"));
};

let queue: QueueService;

beforeEach(() => {
  vi.useFakeTimers();
  queue = new QueueService({ maxWaitMs: MAX_WAIT_MS });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QueueService.run", () => {
  it.each(["resolves", "rejects"] as const)("starts the second task only after the first one %s", async (outcome) => {
    const order: string[] = [];
    const gate = createDeferred();
    const first = queue.run(() => {
      order.push(ORDER_FIRST_START);
      return gate.promise;
    });
    const second = queue.run(() => {
      order.push(ORDER_SECOND_START);
      return Promise.resolve(SECOND_RESULT);
    });
    first.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toStrictEqual([ORDER_FIRST_START]);

    settleFirstWith(gate, outcome);
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toStrictEqual([ORDER_FIRST_START, ORDER_SECOND_START]);
    expect(await second).toBe(SECOND_RESULT);
  });

  it("rejects a task that waited past the maximum with QueueTimeoutError and never runs it", async () => {
    const gate = createDeferred();
    const runWaiting = vi.fn(() => Promise.resolve("waiting"));
    const busy = queue.run(() => gate.promise);
    const waiting = queue.run(runWaiting);
    const waitingOutcome = waiting.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(await waitingOutcome).toBeInstanceOf(QueueTimeoutError);
    expect(runWaiting).not.toHaveBeenCalled();
    gate.resolve(FIRST_RESULT);
    await busy;
  });

  it("removes a waiting task whose signal aborts, and the tasks behind it still run", async () => {
    const gate = createDeferred();
    const controller = new AbortController();
    const busy = queue.run(() => gate.promise);
    const aborted = queue.run(() => Promise.resolve("aborted"), controller.signal);
    const abortedOutcome = aborted.catch((error: unknown) => error);
    const after = queue.run(() => Promise.resolve("after"));

    controller.abort(new Error(ABORT_REASON_MESSAGE));
    const reason = await abortedOutcome;
    gate.resolve(FIRST_RESULT);
    await busy;

    expect(reason).toStrictEqual(new Error(ABORT_REASON_MESSAGE));
    expect(await after).toBe("after");
  });

  it("keeps working when a task throws synchronously", async () => {
    const throwing = queue.run((): Promise<string> => {
      throw new Error("sync failure");
    });
    const next = queue.run(() => Promise.resolve("next"));

    await expect(throwing).rejects.toThrow("sync failure");
    expect(await next).toBe("next");
  });

  it("reports how many calls are waiting or running", async () => {
    const gate = createDeferred();
    const busy = queue.run(() => gate.promise);
    const waiting = queue.run(() => Promise.resolve("waiting"));

    expect(queue.getDepth()).toBe(2);
    gate.resolve(FIRST_RESULT);
    await Promise.all([busy, waiting]);
    expect(queue.getDepth()).toBe(0);
  });
});
