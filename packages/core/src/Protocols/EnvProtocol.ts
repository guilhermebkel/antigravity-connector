export type Env = {
  API_KEY: string;
  HOST: string;
  PORT: number;
  ALLOW_NON_LOOPBACK_BIND: boolean;
  AGY_BIN: string;
  AGY_TIMEOUT_MS: number;
  QUEUE_MAX_WAIT_MS: number;
  DAILY_LIMIT_CHAT: number;
  DAILY_LIMIT_SEARCH: number;
  DAILY_LIMIT_IMAGE: number;
  DAILY_LIMIT_RESEARCH: number;
  DAILY_LIMIT_BROWSE: number;
  DATA_DIR: string;
  HTTP_MAX_REQUESTS_PER_MINUTE: number;
  MCP_MAX_SESSIONS: number;
  MCP_SESSION_TTL_MS: number;
};

export type EnvNameToValue = Readonly<Record<string, string | undefined>>;
