import { z } from "zod";
import { ModelIdSchema, ModelInfoUtil } from "@antigravity-connector/protocol";
import type { BrowseInput } from "@antigravity-connector/mcp/Protocols/BrowseProtocol.ts";
import { BrowseUrlUtil } from "@antigravity-connector/mcp/Utils/BrowseUrlUtil.ts";

const BROWSE_TASK_MAX_LENGTH = 2000;
const BROWSE_URL_MAX_LENGTH = 2048;

export const BrowseInputSchema: z.ZodType<BrowseInput> = z.strictObject({
  task: z.string().trim().min(1).max(BROWSE_TASK_MAX_LENGTH),
  url: z
    .string()
    .trim()
    .max(BROWSE_URL_MAX_LENGTH)
    .refine((url) => BrowseUrlUtil.isAllowed(url), { message: "url must be a public http or https address." })
    .optional(),
  screenshot: z.boolean().optional(),
  model: ModelIdSchema.optional().describe(ModelInfoUtil.buildFieldDescription("The model that drives the page. Flash is the default for simple reads.")),
});
