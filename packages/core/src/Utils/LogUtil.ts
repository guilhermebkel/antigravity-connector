import { RedactUtil } from "@antigravity-connector/protocol";
import type { LogContext, LogEntry, LogLevel } from "@antigravity-connector/core/Protocols/LogProtocol.ts";

export class LogUtil {
  static readonly LEVEL_TO_RANK: Readonly<Record<LogLevel, number>> = { error: 0, warn: 1, info: 2, debug: 3 };

  // Why: the level is read once from LOG_LEVEL at startup (ServerSetup) and applies to every line of the process.
  private static minLevel: LogLevel = "info";

  static setMinLevel(level: LogLevel): void {
    LogUtil.minLevel = level;
  }

  static write(entry: LogEntry, context: LogContext): void {
    if (LogUtil.LEVEL_TO_RANK[entry.level] > LogUtil.LEVEL_TO_RANK[LogUtil.minLevel]) {
      return;
    }
    const line = JSON.stringify({
      time: context.now.toISOString(),
      level: entry.level,
      event: entry.event,
      ...entry.metadata,
    });
    context.sink(RedactUtil.redact(line, context.secrets));
  }
}
