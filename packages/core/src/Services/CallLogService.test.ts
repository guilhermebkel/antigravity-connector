import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { CallLogService } from "@antigravity-connector/core/Services/CallLogService.ts";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";
import { DataDirError } from "@antigravity-connector/core/Errors/DataDirError.ts";
import { RuntimeSetup } from "@antigravity-connector/core/Setup/RuntimeSetup.ts";
import { StubRuntimeUtil } from "@antigravity-connector/core/Testing/StubRuntimeUtil.ts";
import type { CallRecord } from "@antigravity-connector/core/Protocols/CallLogProtocol.ts";

const NOW_MS = Date.UTC(2026, 10, 14, 12, 0, 0);
const MODEL = "gemini-3.8-flash";
const PRIVATE_MARKER = "private-marker-7731";
const EXPECTED_COLUMNS = [
  "id", "started_at", "door", "route_or_tool", "kind", "model", "duration_ms",
  "input_tokens", "output_tokens", "total_tokens", "status",
];
const LIMITS = { chat: 200, search: 50, research: 5, image: 3, browse: 20, media: 20 };

let dataDirectory = "";

const buildRecord = (overrides: Partial<CallRecord> = {}): CallRecord => ({
  startedAt: new Date(NOW_MS).toISOString(),
  door: "api",
  routeOrTool: "/v1/chat/completions",
  kind: "chat",
  model: MODEL,
  durationMs: 1234,
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  status: "success",
  ...overrides,
});

const readRows = (): Record<string, unknown>[] => {
  const database = new DatabaseSync(join(dataDirectory, CallLogService.FILE_NAME));
  const rows = database.prepare("SELECT * FROM calls").all() as Record<string, unknown>[];
  database.close();
  return rows;
};

beforeEach(() => {
  const prefix = join(tmpdir(), "acon-calls-");
  dataDirectory = mkdtempSync(prefix);
});

afterEach(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("CallLogService", () => {
  it("AC1: a completed call writes one row with its kind, model, duration and token counts", () => {
    const callLog = new CallLogService({ dataDirectory });
    callLog.write(buildRecord());
    callLog.close();

    const rows = readRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "chat", model: MODEL, duration_ms: 1234, total_tokens: 15, status: "success" });
  });

  it("AC3: the table has no column that can hold message content", () => {
    const callLog = new CallLogService({ dataDirectory });
    const database = new DatabaseSync(join(dataDirectory, CallLogService.FILE_NAME));
    const infoRows = database.prepare("PRAGMA table_info(calls)").all() as { name: string }[];
    const columns = infoRows.map((column) => column.name);
    database.close();
    callLog.close();

    expect(columns).toStrictEqual(EXPECTED_COLUMNS);
  });

  it("AC4: a data directory that cannot be created fails at startup and names the directory", () => {
    const blocker = join(dataDirectory, "not-a-directory");
    writeFileSync(blocker, "x");
    const unwritable = join(blocker, "data");

    expect(() => new CallLogService({ dataDirectory: unwritable })).toThrow(DataDirError);
    expect(() => new CallLogService({ dataDirectory: unwritable })).toThrow(unwritable);
  });

  it("AC2: after a restart with 3 image calls today and a limit of 3, the next image call fails", () => {
    const first = new CallLogService({ dataDirectory });
    for (let index = 0; index < 3; index += 1) {
      first.write(buildRecord({ kind: "image", routeOrTool: "generate_image", model: MODEL, totalTokens: 1 }));
    }
    first.close();

    const restarted = new CallLogService({ dataDirectory });
    const limits = new DailyLimitService({ runKindToLimit: LIMITS, clock: () => new Date(NOW_MS) });
    RuntimeSetup.seedLimits(restarted, limits, new Date(NOW_MS));
    restarted.close();

    expect(() => {
      limits.consume("image");
    }).toThrow(DailyLimitError);
  });

  it("AC5: a failed call still writes its row with the failure status", async () => {
    const stub = StubRuntimeUtil.build({ respond: () => Promise.reject(new Error("boom")) });

    await expect(
      stub.runService.run("chat", { door: "api", model: MODEL, messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("boom");

    expect(stub.callLog.records).toHaveLength(1);
    expect(stub.callLog.records[0]).toMatchObject({ kind: "chat", status: "error" });
  });

  it("a stored row never holds the prompt text", () => {
    const callLog = new CallLogService({ dataDirectory });
    const record = AgyRunService.buildCallRecord(
      "chat",
      { door: "api", model: MODEL, messages: [{ role: "user", content: PRIVATE_MARKER }] },
      NOW_MS,
      NOW_MS + 5,
      { result: "success" },
    );
    callLog.write(record);
    callLog.close();

    const filePath = join(dataDirectory, CallLogService.FILE_NAME);
    const bytes = readFileSync(filePath);
    const marker = Buffer.from(PRIVATE_MARKER);
    expect(bytes).not.toContain(marker);
  });

  it("removes rows older than the retention window", () => {
    const callLog = new CallLogService({ dataDirectory });
    callLog.write(buildRecord({ startedAt: new Date(NOW_MS - 100 * CallLogService.MS_PER_DAY).toISOString() }));
    callLog.write(buildRecord());
    callLog.removeBefore(new Date(NOW_MS - CallLogService.RETENTION_DAYS * CallLogService.MS_PER_DAY).toISOString());
    const remaining = callLog.countKindsSince(new Date(NOW_MS - CallLogService.MS_PER_DAY).toISOString());
    callLog.close();

    expect(remaining).toStrictEqual({ chat: 1 });
  });
});
