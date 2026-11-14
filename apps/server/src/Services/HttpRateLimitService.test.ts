import { describe, expect, it } from "vitest";
import { HttpRateLimitService } from "@antigravity-connector/server/Services/HttpRateLimitService.ts";

describe("HttpRateLimitService", () => {
  it("allows the limit per bucket in one window, then refuses, without touching the other bucket", () => {
    const service = new HttpRateLimitService({ maxRequestsPerWindow: 2, clock: () => 0 });
    expect(service.consume("failed")).toBe(true);
    expect(service.consume("failed")).toBe(true);
    expect(service.consume("failed")).toBe(false);
    expect(service.consume("authenticated")).toBe(true);
  });

  it("starts a new window after a minute", () => {
    let nowMs = 0;
    const service = new HttpRateLimitService({ maxRequestsPerWindow: 1, clock: () => nowMs });
    expect(service.consume("failed")).toBe(true);
    expect(service.consume("failed")).toBe(false);
    nowMs = HttpRateLimitService.WINDOW_MS;
    expect(service.consume("failed")).toBe(true);
  });
});
