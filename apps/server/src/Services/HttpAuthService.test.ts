import { describe, expect, it } from "vitest";
import { HttpAuthService } from "@antigravity-connector/server/Services/HttpAuthService.ts";

const API_KEY = "test-api-key-0123456789abcdef";

describe("HttpAuthService", () => {
  const service = new HttpAuthService(API_KEY);

  it("accepts the right bearer", () => {
    expect(service.isAuthorized(`Bearer ${API_KEY}`)).toBe(true);
  });

  it("refuses a bearer of the same length and a bearer of another length", () => {
    const sameLength = "x".repeat(API_KEY.length);
    expect(service.isAuthorized(`Bearer ${sameLength}`)).toBe(false);
    expect(service.isAuthorized(`Bearer ${API_KEY}x`)).toBe(false);
    expect(service.isAuthorized(`Bearer ${API_KEY.slice(1)}`)).toBe(false);
  });

  it("refuses a missing header and a header without the Bearer scheme", () => {
    expect(service.isAuthorized(undefined)).toBe(false);
    expect(service.isAuthorized(API_KEY)).toBe(false);
  });
});
