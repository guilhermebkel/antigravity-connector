import { z } from "zod";
import type { Env } from "@antigravity-connector/core/Protocols/EnvProtocol.ts";

const MIN_API_KEY_LENGTH = 24;
const MAX_PORT = 65535;
const DEFAULT_PORT = 8787;
const DEFAULT_AGY_TIMEOUT_MS = 300000;
const DEFAULT_QUEUE_MAX_WAIT_MS = 120000;
const DEFAULT_QUEUE_CONCURRENCY = 4;
const MAX_QUEUE_CONCURRENCY = 8;
const DEFAULT_DAILY_LIMIT_CHAT = 200;
const DEFAULT_DAILY_LIMIT_SEARCH = 50;
const DEFAULT_DAILY_LIMIT_IMAGE = 20;
const DEFAULT_DAILY_LIMIT_RESEARCH = 5;
const DEFAULT_DAILY_LIMIT_BROWSE = 20;
const DEFAULT_HTTP_MAX_REQUESTS_PER_MINUTE = 120;
const DEFAULT_MCP_MAX_SESSIONS = 8;
const DEFAULT_MCP_SESSION_TTL_MS = 1800000;
const DEFAULT_DATA_DIR = "data";
const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;
const DEFAULT_LOG_LEVEL = "info";

const PublicUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url({ protocol: /^https?$/ })
    .refine((value) => URL.canParse(value) && new URL(value).pathname === "/", "must be an origin such as https://connector.example.com")
    .optional(),
);

export const EnvSchema: z.ZodType<Env> = z.object({
  API_KEY: z.string().min(MIN_API_KEY_LENGTH),
  LOG_LEVEL: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  ALLOW_NON_LOOPBACK_BIND: z.stringbool().default(false),
  AGY_BIN: z.string().min(1).default("agy"),
  AGY_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_AGY_TIMEOUT_MS),
  QUEUE_MAX_WAIT_MS: z.coerce.number().int().positive().default(DEFAULT_QUEUE_MAX_WAIT_MS),
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(MAX_QUEUE_CONCURRENCY).default(DEFAULT_QUEUE_CONCURRENCY),
  DAILY_LIMIT_CHAT: z.coerce.number().int().nonnegative().default(DEFAULT_DAILY_LIMIT_CHAT),
  DAILY_LIMIT_SEARCH: z.coerce.number().int().nonnegative().default(DEFAULT_DAILY_LIMIT_SEARCH),
  DAILY_LIMIT_IMAGE: z.coerce.number().int().nonnegative().default(DEFAULT_DAILY_LIMIT_IMAGE),
  DAILY_LIMIT_RESEARCH: z.coerce.number().int().nonnegative().default(DEFAULT_DAILY_LIMIT_RESEARCH),
  DAILY_LIMIT_BROWSE: z.coerce.number().int().nonnegative().default(DEFAULT_DAILY_LIMIT_BROWSE),
  HTTP_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(DEFAULT_HTTP_MAX_REQUESTS_PER_MINUTE),
  MCP_MAX_SESSIONS: z.coerce.number().int().positive().default(DEFAULT_MCP_MAX_SESSIONS),
  MCP_SESSION_TTL_MS: z.coerce.number().int().positive().default(DEFAULT_MCP_SESSION_TTL_MS),
  DATA_DIR: z.string().min(1).default(DEFAULT_DATA_DIR),
  PUBLIC_URL: PublicUrlSchema,
});
