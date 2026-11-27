import type { LogLevel } from "@antigravity-connector/core/Protocols/LogProtocol.ts";

export type Env = {
  API_KEY: string;
  LOG_LEVEL: LogLevel;
  HOST: string;
  PORT: number;
  ALLOW_NON_LOOPBACK_BIND: boolean;
  AGY_BIN: string;
  AGY_TIMEOUT_MS: number;
  AGY_OUTPUT_WAIT_MS: number;
  QUEUE_MAX_WAIT_MS: number;
  QUEUE_CONCURRENCY: number;
  DAILY_LIMIT_CHAT: number;
  DAILY_LIMIT_SEARCH: number;
  DAILY_LIMIT_IMAGE: number;
  DAILY_LIMIT_RESEARCH: number;
  DAILY_LIMIT_BROWSE: number;
  DAILY_LIMIT_MEDIA: number;
  DATA_DIR: string;
  PUBLIC_URL?: string | undefined;
  HTTP_MAX_REQUESTS_PER_MINUTE: number;
  MCP_MAX_SESSIONS: number;
  MCP_SESSION_TTL_MS: number;
};

export type EnvNameToValue = Readonly<Record<string, string | undefined>>;
