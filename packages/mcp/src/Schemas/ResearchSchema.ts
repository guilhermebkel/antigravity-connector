import { z } from "zod";
import { ModelIdSchema, ModelInfoUtil } from "@antigravity-connector/protocol";
import type { ResearchInput } from "@antigravity-connector/mcp/Protocols/ResearchProtocol.ts";

const RESEARCH_TOPIC_MAX_LENGTH = 2000;

export const ResearchInputSchema: z.ZodType<ResearchInput> = z.strictObject({
  topic: z.string().trim().min(1).max(RESEARCH_TOPIC_MAX_LENGTH),
  model: ModelIdSchema.optional().describe(ModelInfoUtil.buildFieldDescription("The model that writes the report. Argon is the pro choice for broad topics. Avoid Carbon here: in plan mode it returns a plan instead of a report.")),
});
