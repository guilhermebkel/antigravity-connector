import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RunKind } from "@antigravity-connector/protocol";
import type { CallLogPort, CallRecord } from "@antigravity-connector/core/Protocols/CallLogProtocol.ts";
import { DataDirError } from "@antigravity-connector/core/Errors/DataDirError.ts";

export type CallLogServiceOptions = { dataDirectory: string };

export type RunKindToCount = Partial<Record<RunKind, number>>;

export class CallLogService implements CallLogPort {
  static readonly FILE_NAME = "calls.sqlite";

  static readonly RETENTION_DAYS = 90;

  static readonly MS_PER_DAY = 86400000;

  static readonly BUSY_TIMEOUT_SQL = "PRAGMA busy_timeout = 5000";

  static readonly CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    door TEXT NOT NULL,
    route_or_tool TEXT NOT NULL,
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    status TEXT NOT NULL
  )`;

  static readonly INSERT_SQL = `INSERT INTO calls
    (started_at, door, route_or_tool, kind, model, duration_ms, input_tokens, output_tokens, total_tokens, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  static readonly COUNT_SQL = "SELECT kind, COUNT(*) AS total FROM calls WHERE started_at >= ? GROUP BY kind";

  static readonly DELETE_SQL = "DELETE FROM calls WHERE started_at < ?";

  private readonly database: DatabaseSync;

  constructor(options: CallLogServiceOptions) {
    const filePath = join(options.dataDirectory, CallLogService.FILE_NAME);
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      this.database = new DatabaseSync(filePath);
      this.database.exec(CallLogService.BUSY_TIMEOUT_SQL);
      this.database.exec(CallLogService.CREATE_TABLE_SQL);
    } catch {
      throw new DataDirError(options.dataDirectory);
    }
  }

  write(record: CallRecord): void {
    const statement = this.database.prepare(CallLogService.INSERT_SQL);
    const values = [
      record.startedAt,
      record.door,
      record.routeOrTool,
      record.kind,
      record.model,
      record.durationMs,
      record.inputTokens,
      record.outputTokens,
      record.totalTokens,
      record.status,
    ];
    statement.run(...values);
  }

  countKindsSince(sinceIso: string): RunKindToCount {
    const statement = this.database.prepare(CallLogService.COUNT_SQL);
    const rows = statement.all(sinceIso) as {
      kind: RunKind; total: number;
    }[];
    return Object.fromEntries(rows.map((row) => [row.kind, row.total]));
  }

  removeBefore(cutoffIso: string): void {
    this.database.prepare(CallLogService.DELETE_SQL).run(cutoffIso);
  }

  close(): void {
    this.database.close();
  }
}
