import { QueueTimeoutError } from "@antigravity-connector/core/Errors/QueueTimeoutError.ts";

export type QueueOptions = { maxWaitMs: number };

type WaitingEntry = {
  startTask: () => void;
  failTask: (reason: Error) => void;
  cleanup: () => void;
  signal: AbortSignal | undefined;
};

export class QueueService {
  static readonly ABORTED_MESSAGE = "The call was aborted before it ran";

  private readonly maxWaitMs: number;

  private isBusy = false;

  private readonly waiting: WaitingEntry[] = [];

  constructor(options: QueueOptions) {
    this.maxWaitMs = options.maxWaitMs;
  }

  getDepth(): number {
    return this.waiting.length + (this.isBusy ? 1 : 0);
  }

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(QueueService.buildError(signal.reason));
        return;
      }
      if (!this.isBusy) {
        this.startTask(task, resolve, reject);
        return;
      }
      this.addWaiting({
        startTask: () => {
          this.startTask(task, resolve, reject);
        },
        failTask: reject,
        cleanup: () => undefined,
        signal,
      });
    });
  }

  private startTask<T>(task: () => Promise<T>, resolve: (value: T) => void, reject: (reason: Error) => void): void {
    this.isBusy = true;
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
    this.isBusy = false;
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
