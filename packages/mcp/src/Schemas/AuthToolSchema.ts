import { z } from "zod";
import { AuthCodeRequestSchema, AuthStatusResponseSchema } from "@antigravity-connector/protocol";
import type { CheckAuthInput, SetAuthInput } from "@antigravity-connector/mcp/Protocols/AuthToolProtocol.ts";

export const CheckAuthInputSchema: z.ZodType<CheckAuthInput> = z.strictObject({});

export const SetAuthInputSchema: z.ZodType<SetAuthInput> = AuthCodeRequestSchema;

export const AuthToolOutputSchema = AuthStatusResponseSchema;
