import { z } from "zod";
import type { CheckUsageInput, CheckUsageOutput } from "@antigravity-connector/mcp/Protocols/CheckUsageProtocol.ts";

export const CheckUsageInputSchema: z.ZodType<CheckUsageInput> = z.strictObject({});

export const CheckUsageOutputSchema: z.ZodType<CheckUsageOutput> = z.strictObject({
  checkedAt: z.string().describe("When agy was asked for the limits, as an ISO time."),
  groups: z.array(z.strictObject({
    name: z.string().describe("A group of models that share their limits, such as Gemini Models."),
    limits: z.array(z.strictObject({
      name: z.string(),
      window: z.enum(["five_hour", "weekly", "other"]),
      remainingPercent: z.number().describe("How much of the limit is left, from 0 to 100."),
      resetsAt: z.string().optional().describe("When the limit refills, as an ISO time. Absent when the window has not started."),
    })),
  })),
});
