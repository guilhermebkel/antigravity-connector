import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpProgressService } from "@antigravity-connector/mcp/Services/McpProgressService.ts";

const MARKER = "private-marker-7731";

describe("McpProgressService", () => {
  let nowMs: number;
  let sent: {
    progress: number; message: string;
  }[];
  let service: McpProgressService;

  beforeEach(() => {
    vi.useFakeTimers();
    nowMs = 0;
    sent = [];
    service = new McpProgressService({
      clock: () => nowMs,
      send: (progress, message) => {
        sent.push({ progress, message });
      },
    });
  });

  afterEach(() => {
    service.close();
    vi.useRealTimers();
  });

  it("AC3: twenty deltas in one second send at most two notifications", () => {
    service.start();
    for (let delta = 0; delta < 20; delta += 1) {
      nowMs += 50;
      service.observe({ kind: "text" });
    }
    vi.advanceTimersByTime(1000);
    expect(sent.length).toBeLessThanOrEqual(2);
    expect(sent[0]?.progress).toBe(1);
  });

  it("S1: a queued position, then the start, are sent in that order", () => {
    service.observe({ kind: "queued", position: 2 });
    nowMs = 1000;
    service.observe({ kind: "started" });
    expect(sent.map((item) => item.message)).toStrictEqual([
      "Waiting in the agy queue at position 2.",
      "Started the run.",
    ]);
  });

  it("S2: a notification is sent at least every 15 seconds while the call is alive", () => {
    service.start();
    service.observe({ kind: "started" });
    vi.advanceTimersByTime(McpProgressService.HEARTBEAT_MS);
    expect(sent.length).toBeGreaterThanOrEqual(2);
  });

  it("AC5: no message contains what the client asked", () => {
    service.observe({ kind: "activity", stepType: "tool" });
    service.observe({ kind: "text" });
    expect(sent.some((item) => item.message.includes(MARKER))).toBe(false);
  });

  it("the progress counter only grows", () => {
    service.observe({ kind: "started" });
    nowMs = 5000;
    service.observe({ kind: "text" });
    expect(sent.map((item) => item.progress)).toStrictEqual([1, 2]);
  });
});
