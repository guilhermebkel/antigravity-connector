import { RedactUtil } from "@antigravity-connector/protocol";
import type { LogContext, LogEntry } from "@antigravity-connector/core/Protocols/LogProtocol.ts";

export class LogUtil {
  static write(entry: LogEntry, context: LogContext): void {
    const line = JSON.stringify({
      time: context.now.toISOString(),
      level: entry.level,
      event: entry.event,
      ...entry.metadata,
    });
    context.sink(RedactUtil.redact(line, context.secrets));
  }
}
