import { z } from "zod";
import { ModelIdSchema, ModelInfoUtil } from "@antigravity-connector/protocol";
import type { WebSearchInput } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";

const WEB_SEARCH_QUERY_MAX_LENGTH = 2000;

export const WebSearchInputSchema: z.ZodType<WebSearchInput> = z.strictObject({
  query: z.string().trim().min(1).max(WEB_SEARCH_QUERY_MAX_LENGTH),
  model: ModelIdSchema.optional().describe(ModelInfoUtil.buildFieldDescription("The model that searches the web and writes the cited answer. Flash is the default for quick answers.")),
});
