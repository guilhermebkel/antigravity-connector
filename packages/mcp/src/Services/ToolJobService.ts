import { randomUUID } from "node:crypto";
import type { ToolJob, ToolJobKind, ToolJobRun } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";

export type ToolJobServiceOptions = {
  clock: () => number;
  waitMs?: number;
  ttlMs?: number;
};

export class ToolJobService {
  // Why: the client gives up on a tool call at about 60 s (issue #39). A call waits this long for its result, then returns a job id; short, so the client asks again instead of holding a call open.
  static readonly WAIT_MS = 20000;

  // Why: a finished result stays for ten minutes, long enough to ask for it after the retry delay, and short enough that the bytes do not pile up in memory.
  static readonly TTL_MS = 600000;

  static readonly RETRY_AFTER_SECONDS = 15;

  readonly waitMs: number;

  readonly ttlMs: number;

  readonly retryAfterSeconds = ToolJobService.RETRY_AFTER_SECONDS;

  private readonly clock: () => number;

  private readonly idToJob = new Map<string, ToolJob>();

  constructor(options: ToolJobServiceOptions) {
    this.clock = options.clock;
    this.waitMs = options.waitMs ?? ToolJobService.WAIT_MS;
    this.ttlMs = options.ttlMs ?? ToolJobService.TTL_MS;
  }

  start(kind: ToolJobKind, run: ToolJobRun): ToolJob {
    // Why: the job is not tied to the request that started it: after the wait, a client that stops asking does not cancel the run its owner's quota already paid for. Only a cancel during the wait stops it (see waitUpTo).
    const controller = new AbortController();
    const job: ToolJob = {
      controller,
      kind,
      id: randomUUID(),
      state: "running",
      startedAtMs: this.clock(),
      done: Promise.resolve(),
    };
    job.done = Promise.resolve().then(() => run(controller.signal)).then(
      (result) => {
        job.state = "finished";
        job.run = result;
        job.finishedAtMs = this.clock();
      },
      (error: unknown) => {
        job.state = "failed";
        job.error = error instanceof Error ? error : new Error(String(error));
        job.finishedAtMs = this.clock();
      },
    );
    this.idToJob.set(job.id, job);
    return job;
  }

  get(id: string): ToolJob | undefined {
    this.removeExpired();
    return this.idToJob.get(id);
  }

  waitUpTo(job: ToolJob, requestSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      let isWaiting = true;
      let timer: ReturnType<typeof setTimeout> | undefined = undefined;
      const end = (): void => {
        isWaiting = false;
        clearTimeout(timer);
        resolve();
      };
      const cancel = (): void => {
        if (isWaiting) {
          // Why: a client that cancels while it waits stops the run, as a synchronous call would; after the wait this does nothing, so the run goes on.
          job.controller.abort();
          end();
        }
      };
      if (requestSignal?.aborted === true) {
        cancel();
        return;
      }
      requestSignal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(end, this.waitMs);
      void job.done.then(end);
    });
  }

  private removeExpired(): void {
    const now = this.clock();
    for (const [id, job] of this.idToJob) {
      // Why: a running job is never removed, so a slow result is still there when its owner asks for it.
      if (job.finishedAtMs !== undefined && now - job.finishedAtMs >= this.ttlMs) {
        this.idToJob.delete(id);
      }
    }
  }
}
