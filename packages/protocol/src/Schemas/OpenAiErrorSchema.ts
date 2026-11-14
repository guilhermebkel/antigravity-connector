import { z } from "zod";
import type { OpenAiError, OpenAiErrorType } from "@antigravity-connector/protocol/Protocols/OpenAiErrorProtocol.ts";
import { OpenAiErrorCodeSchema } from "@antigravity-connector/protocol/Schemas/OpenAiErrorCodeSchema.ts";

const OpenAiErrorTypeSchema: z.ZodType<OpenAiErrorType> = z.enum([
  "invalid_request_error",
  "authentication_error",
  "rate_limit_error",
  "server_error",
]);

export const OpenAiErrorSchema: z.ZodType<OpenAiError> = z.looseObject({
  error: z.looseObject({
    message: z.string(),
    type: OpenAiErrorTypeSchema,
    param: z.string().nullable(),
    code: OpenAiErrorCodeSchema.nullable(),
  }),
});
