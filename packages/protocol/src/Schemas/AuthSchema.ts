import { z } from "zod";
import type { AuthCodeRequest, AuthStatusResponse } from "@antigravity-connector/protocol/Protocols/AuthProtocol.ts";

const AUTH_CODE_MAX_LENGTH = 512;

export const AuthCodeRequestSchema: z.ZodType<AuthCodeRequest> = z.strictObject({
  code: z.string().trim().min(1).max(AUTH_CODE_MAX_LENGTH),
});

export const AuthStatusResponseSchema: z.ZodType<AuthStatusResponse> = z.object({
  status: z.enum(["connected", "login_required", "unavailable"]),
  login_url: z.string().optional(),
  expires_in_seconds: z.number().optional(),
  reason: z.string().optional(),
});
