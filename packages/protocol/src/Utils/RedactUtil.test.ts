import { describe, expect, it } from "vitest";
import { RedactUtil } from "@antigravity-connector/protocol/Utils/RedactUtil.ts";

const FAKE_SECRET = "sk-fake-secret-123";

describe("RedactUtil.redact", () => {
  it("removes a planted OpenAI-style key", () => {
    expect(RedactUtil.redact(`token ${FAKE_SECRET} rejected`, [])).toBe("token [redacted] rejected");
  });

  it("removes a configured secret wherever it appears", () => {
    expect(RedactUtil.redact("key=test-api-key-0123456789abcdef here", ["test-api-key-0123456789abcdef"])).toBe(
      "key=[redacted] here",
    );
  });

  it("removes a bearer token", () => {
    expect(RedactUtil.redact("Authorization: Bearer abc.def", [])).toBe("Authorization: [redacted]");
  });

  it("removes an OAuth access token and an authorization code", () => {
    expect(RedactUtil.redact("ya29.a0AfB_fake-token and 4/0AUn6Hd968U2Eb8kl", [])).toBe("[redacted] and [redacted]");
  });

  it("leaves text without secrets unchanged", () => {
    expect(RedactUtil.redact("agy exited with code 1", [])).toBe("agy exited with code 1");
  });

  it("ignores an empty secret instead of removing every character", () => {
    expect(RedactUtil.redact("abc", [""])).toBe("abc");
  });
});

describe("RedactUtil.buildExcerpt", () => {
  it("cuts text longer than the maximum and marks the cut", () => {
    const excerpt = RedactUtil.buildExcerpt("x".repeat(600), []);

    expect(excerpt).toBe(`${"x".repeat(500)}...`);
  });
});
