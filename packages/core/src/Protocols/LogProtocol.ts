export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFieldToValue = Readonly<Record<string, string | number | boolean>>;

export type LogEntry = {
  level: LogLevel;
  event: string;
  metadata: LogFieldToValue;
};

export type LogSink = (line: string) => void;

export type LogContext = {
  now: Date;
  secrets: readonly string[];
  sink: LogSink;
};
