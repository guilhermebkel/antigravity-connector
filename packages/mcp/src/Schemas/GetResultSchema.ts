import { z } from "zod";
import type { GetResultInput } from "@antigravity-connector/mcp/Protocols/GetResultProtocol.ts";

export const GetResultInputSchema: z.ZodType<GetResultInput> = z.strictObject({
  job_id: z.uuid(),
});
