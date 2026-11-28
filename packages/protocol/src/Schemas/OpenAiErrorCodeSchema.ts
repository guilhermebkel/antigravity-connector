import { z } from "zod";
import type { OpenAiErrorCode } from "@antigravity-connector/protocol/Protocols/OpenAiErrorProtocol.ts";

export const OpenAiErrorCodeSchema: z.ZodType<OpenAiErrorCode> = z.enum([
  "invalid_api_key",
  "invalid_request_error",
  "tools_not_supported",
  "model_not_found",
  "queue_timeout",
  "daily_limit_reached",
  "agy_session_required",
  "agy_failed",
  "agy_timeout",
  "image_not_produced",
  "image_invalid",
  "image_quota_exhausted",
]);
