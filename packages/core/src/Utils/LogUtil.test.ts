import { describe, expect, it } from "vitest";
import { LogUtil } from "@antigravity-connector/core/Utils/LogUtil.ts";
import type { LogFieldToValue } from "@antigravity-connector/core/Protocols/LogProtocol.ts";

const FAKE_API_KEY = "test-api-key-0123456789abcdef";
const NOW = new Date("2026-11-14T10:00:00.000Z");

const writeAndCollect = (metadata: LogFieldToValue): string[] => {
  const lines: string[] = [];
  LogUtil.write(
    { level: "info", event: "chat_call", metadata },
    { now: NOW, secrets: [FAKE_API_KEY], sink: (line) => lines.push(line) },
  );
  return lines;
};

describe("LogUtil.write", () => {
  it("writes one JSON line with the level, the time, the event and the metadata", () => {
    const lines = writeAndCollect({ model: "gemini-3.8-flash", durationMs: 4300 });

    expect(lines).toStrictEqual([
      "{\"time\":\"2026-11-14T10:00:00.000Z\",\"level\":\"info\",\"event\":\"chat_call\",\"model\":\"gemini-3.8-flash\",\"durationMs\":4300}",
    ]);
  });

  it("removes the API key and a bearer token from every field", () => {
    const [line] = writeAndCollect({ note: `key ${FAKE_API_KEY} and Bearer abc.def` });

    expect(line).toBe(
      "{\"time\":\"2026-11-14T10:00:00.000Z\",\"level\":\"info\",\"event\":\"chat_call\",\"note\":\"key [redacted] and [redacted]\"}",
    );
    expect(line).not.toContain(FAKE_API_KEY);
    expect(line).not.toContain("abc.def");
  });
});
