import { describe, expect, it } from "vitest";
import { ImageQuotaError } from "@antigravity-connector/core";
import { ApiErrorUtil } from "@antigravity-connector/api/Utils/ApiErrorUtil.ts";

describe("ApiErrorUtil.build", () => {
  it("answers an image quota as 429 rate_limit_error, with the reset time in the message", () => {
    const response = ApiErrorUtil.build(new ImageQuotaError("2026-11-28T11:09:00.000Z", 42));

    expect(response.statusCode).toBe(429);
    expect(response.body.error).toMatchObject({ code: "image_quota_exhausted", type: "rate_limit_error" });
    expect(response.body.error.message).toContain("2026-11-28T11:09:00.000Z");
  });
});
