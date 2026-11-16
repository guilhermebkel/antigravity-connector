import { describe, expect, it } from "vitest";
import { RemoteImageUrlUtil } from "@antigravity-connector/core/Utils/RemoteImageUrlUtil.ts";

describe("RemoteImageUrlUtil", () => {
  it("accepts a plain https URL and keeps its query", () => {
    const result = RemoteImageUrlUtil.parse("https://cdn.example.com/a/photo.jpg?size=large");
    expect(result.isValid).toBe(true);
    expect(result).toStrictEqual({ isValid: true, url: new URL("https://cdn.example.com/a/photo.jpg?size=large") });
  });

  it("accepts a long signed URL and credentials in the address", () => {
    const signed = `https://user:pass@cdn.example.com/photo.png?signature=${"a".repeat(3000)}`;
    expect(RemoteImageUrlUtil.parse(signed).isValid).toBe(true);
  });

  it.each([
    ["http://example.com/a.png", "not_https"],
    ["ftp://example.com/a.png", "not_https"],
    ["file:///etc/passwd", "not_https"],
    ["not a url", "invalid_url"],
    ["", "invalid_url"],
    [`https://example.com/${"a".repeat(RemoteImageUrlUtil.MAX_URL_LENGTH)}`, "invalid_url"],
  ])("refuses %s as %s", (url, reason) => {
    expect(RemoteImageUrlUtil.parse(url)).toStrictEqual({ isValid: false, reason });
  });
});
