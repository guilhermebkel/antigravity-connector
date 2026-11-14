import { describe, expect, it } from "vitest";
import { HttpErrorUtil } from "@antigravity-connector/server/Utils/HttpErrorUtil.ts";

describe("HttpErrorUtil", () => {
  it("maps the Fastify body errors to their failure kinds", () => {
    expect(HttpErrorUtil.readFailure("FST_ERR_CTP_INVALID_JSON_BODY")).toBe("invalid_json");
    expect(HttpErrorUtil.readFailure("FST_ERR_CTP_BODY_TOO_LARGE")).toBe("body_too_large");
  });

  it("maps any other error to an internal failure, without its message", () => {
    expect(HttpErrorUtil.readFailure(undefined)).toBe("internal_error");
    expect(HttpErrorUtil.readFailure("constructor")).toBe("internal_error");
  });
});
