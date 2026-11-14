import { describe, expect, it } from "vitest";
import { BearerUtil } from "@antigravity-connector/server/Utils/BearerUtil.ts";

describe("BearerUtil", () => {
  it("reads the token of a Bearer header, with any case of the scheme", () => {
    expect(BearerUtil.readToken("Bearer abc")).toBe("abc");
    expect(BearerUtil.readToken("bearer abc")).toBe("abc");
  });

  it("returns undefined when the header is missing or not a Bearer header", () => {
    expect(BearerUtil.readToken(undefined)).toBeUndefined();
    expect(BearerUtil.readToken("Basic abc")).toBeUndefined();
    expect(BearerUtil.readToken("Bearer ")).toBeUndefined();
  });
});
