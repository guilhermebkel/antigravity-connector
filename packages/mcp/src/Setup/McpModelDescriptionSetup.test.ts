import { describe, expect, it } from "vitest";
import { ModelInfoUtil } from "@antigravity-connector/protocol";
import { McpHarnessUtil } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

type JsonSchemaProperty = { description?: string };
type ToolSchema = { properties?: { model?: JsonSchemaProperty } };

const TOOLS_WITH_MODEL = [
  "generate_image",
  "web_search",
  "research",
  "browse",
  "transcribe_audio",
  "analyse_video",
];

describe("the model field of every tool that takes one", () => {
  it("lists every model with its description in the tool schema", async () => {
    const harness = await McpHarnessUtil.start();
    const client = await McpHarnessUtil.connect(harness.address);
    const { tools } = await client.listTools();

    for (const name of TOOLS_WITH_MODEL) {
      const tool = tools.find((candidate) => candidate.name === name);
      const schema = tool?.inputSchema as ToolSchema | undefined;
      const description = schema?.properties?.model?.description ?? "";
      expect(description).toContain("Models: ");
      for (const [id, text] of Object.entries(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION)) {
        expect(description).toContain(`${id}: ${text}`);
      }
    }
    await client.close();
    await harness.app.close();
  });
});
