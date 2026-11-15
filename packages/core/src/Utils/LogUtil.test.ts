import { afterEach, describe, expect, it } from "vitest";
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

describe("LogUtil level threshold", () => {
  afterEach(() => {
    LogUtil.setMinLevel("info");
  });

  it("with warn, shows warn and error and hides info and debug", () => {
    LogUtil.setMinLevel("warn");
    const lines: string[] = [];
    const context = { now: NOW, secrets: [FAKE_API_KEY], sink: (line: string) => lines.push(line) };
    LogUtil.write({ level: "info", event: "a.b.info", metadata: {} }, context);
    LogUtil.write({ level: "warn", event: "a.b.warn", metadata: {} }, context);
    LogUtil.write({ level: "error", event: "a.b.error", metadata: {} }, context);
    LogUtil.write({ level: "debug", event: "a.b.debug", metadata: {} }, context);

    const events = lines.map((line) => (JSON.parse(line) as { event: string }).event);
    expect(events).toStrictEqual(["a.b.warn", "a.b.error"]);
  });

  it("the default threshold is info: debug is hidden", () => {
    const lines: string[] = [];
    LogUtil.write({ level: "debug", event: "a.b.debug", metadata: {} }, { now: NOW, secrets: [], sink: (line) => lines.push(line) });

    expect(lines).toStrictEqual([]);
  });
});
