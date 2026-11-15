import { QueueTimeoutError } from "@antigravity-connector/core/Errors/QueueTimeoutError.ts";
import type { QueueHooks } from "@antigravity-connector/core/Protocols/QueueHooksProtocol.ts";

export type QueueOptions = {
  maxWaitMs: number;
  concurrency: number;
};

type WaitingEntry = {
  startTask: () => void;
  failTask: (reason: Error) => void;
  cleanup: () => void;
  signal: AbortSignal | undefined;
};

export class QueueService {
  static readonly ABORTED_MESSAGE = "The call was aborted before it ran";

  private readonly maxWaitMs: number;

  private readonly concurrency: number;

  // Why: the number of agy runs in flight. The daily limits count calls, not runs, so this only bounds how many run at once.
  private runningCount = 0;

  private readonly waiting: WaitingEntry[] = [];

  constructor(options: QueueOptions) {
    this.maxWaitMs = options.maxWaitMs;
    this.concurrency = options.concurrency;
  }

  getDepth(): number {
    return this.waiting.length + this.runningCount;
  }

  run<T>(task: () => Promise<T>, signal?: AbortSignal, hooks?: QueueHooks): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(QueueService.buildError(signal.reason));
        return;
      }
      const start = (): void => {
        hooks?.onStarted?.();
        this.startTask(task, resolve, reject);
      };
      if (this.runningCount < this.concurrency) {
        start();
        return;
      }
      this.addWaiting({ startTask: start, failTask: reject, cleanup: () => undefined, signal });
      hooks?.onWaiting?.(this.waiting.length);
    });
  }

  private startTask<T>(task: () => Promise<T>, resolve: (value: T) => void, reject: (reason: Error) => void): void {
    this.runningCount += 1;
    void this.settleTask(task, resolve, reject);
  }

  private async settleTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
  ): Promise<void> {
    try {
      resolve(await task());
    } catch (error: unknown) {
      reject(QueueService.buildError(error));
    } finally {
      this.finishTask();
    }
  }

  private finishTask(): void {
    this.runningCount -= 1;
    const next = this.waiting.shift();
    if (next !== undefined) {
      next.cleanup();
      next.startTask();
    }
  }

  private addWaiting(entry: WaitingEntry): void {
    const timer = setTimeout(() => {
      this.removeWaiting(entry);
      entry.failTask(new QueueTimeoutError(this.maxWaitMs));
    }, this.maxWaitMs);
    const onAbort = (): void => {
      this.removeWaiting(entry);
      entry.failTask(QueueService.buildError(entry.signal?.reason));
    };
    entry.signal?.addEventListener("abort", onAbort, { once: true });
    entry.cleanup = () => {
      clearTimeout(timer);
      entry.signal?.removeEventListener("abort", onAbort);
    };
    this.waiting.push(entry);
  }

  private removeWaiting(entry: WaitingEntry): void {
    const index = this.waiting.indexOf(entry);
    if (index >= 0) {
      this.waiting.splice(index, 1);
    }
    entry.cleanup();
  }

  static buildError(reason: unknown): Error {
    return reason instanceof Error ? reason : new Error(QueueService.ABORTED_MESSAGE);
  }
}
