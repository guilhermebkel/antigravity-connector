import { describe, expect, it } from "vitest";
import type { McpToolRun } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { ToolRunOutput } from "@antigravity-connector/mcp/Protocols/ToolJobProtocol.ts";
import { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

const RESULT: McpToolRun<ToolRunOutput> = { output: { model: "gemini-3.8-flash", durationMs: 10, totalTokens: 5 }, extraContent: [] };

const buildClock = () => {
  const clock = { now: 0 };
  return { clock, read: () => clock.now };
};

describe("ToolJobService", () => {
  it("a job that finishes is kept with its result, and waitUpTo returns as soon as it finishes", async () => {
    const { read } = buildClock();
    const service = new ToolJobService({ clock: read, waitMs: 60000 });
    const job = service.start("research", () => Promise.resolve(RESULT));
    expect(job.state).toBe("running");
    await service.waitUpTo(job);
    expect(job.state).toBe("finished");
    expect(job.run).toBe(RESULT);
    expect(service.get(job.id)).toBe(job);
  });

  it("a job that fails is kept with its error", async () => {
    const { read } = buildClock();
    const service = new ToolJobService({ clock: read, waitMs: 60000 });
    const job = service.start("browse", () => Promise.reject(new Error("agy said no")));
    await service.waitUpTo(job);
    expect(job.state).toBe("failed");
    expect(job.error?.message).toBe("agy said no");
  });

  it("waitUpTo gives up after waitMs and leaves a slow job running", async () => {
    const { read } = buildClock();
    const service = new ToolJobService({ clock: read, waitMs: 10 });
    const job = service.start("image", () => new Promise<McpToolRun<ToolRunOutput>>(() => undefined));
    await service.waitUpTo(job);
    expect(job.state).toBe("running");
    expect(service.get(job.id)).toBe(job);
  });

  it("a cancel of the request during the wait stops the job; after the wait it does not", async () => {
    const { read } = buildClock();
    const service = new ToolJobService({ clock: read, waitMs: 60000 });
    const during = service.start("image", (signal) => new Promise<McpToolRun<ToolRunOutput>>((_resolve, reject) => {
      const abortRun = (): void => {
        reject(new Error("aborted"));
      };
      if (signal.aborted) {
        abortRun();
        return;
      }
      signal.addEventListener("abort", abortRun);
    }));
    const request = new AbortController();
    const waiting = service.waitUpTo(during, request.signal);
    request.abort();
    await waiting;
    expect(during.controller.signal.aborted).toBe(true);
    await during.done;
    expect(during.state).toBe("failed");

    const after = service.start("research", () => new Promise<McpToolRun<ToolRunOutput>>(() => undefined));
    const shortService = new ToolJobService({ clock: read, waitMs: 5 });
    const late = new AbortController();
    const shortWait = shortService.waitUpTo(after, late.signal);
    await shortWait;
    late.abort();
    expect(after.controller.signal.aborted).toBe(false);
  });

  it("a finished job is removed after its ttl, and a running job is never removed", async () => {
    const { clock, read } = buildClock();
    const service = new ToolJobService({ clock: read, waitMs: 10, ttlMs: 100 });
    const running = service.start("image", () => new Promise<McpToolRun<ToolRunOutput>>(() => undefined));
    const finished = service.start("web_search", () => Promise.resolve(RESULT));
    await service.waitUpTo(finished);
    clock.now = 99;
    expect(service.get(finished.id)).toBe(finished);
    clock.now = 100;
    expect(service.get(finished.id)).toBeUndefined();
    clock.now = 100000;
    expect(service.get(running.id)).toBe(running);
  });
});
