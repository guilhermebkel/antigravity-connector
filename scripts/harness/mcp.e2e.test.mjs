import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { API_KEY, startServer, stopAllServers } from "./ServerProcess.mjs";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe("the built server, MCP door", () => {
  let server;
  let client;

  beforeAll(async () => {
    server = await startServer();
    client = new Client({ name: "e2e", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${API_KEY}` } },
    }));
  });

  afterAll(async () => {
    await client.close();
    await stopAllServers();
  });

  it("initialize returns the instructions and tools/list offers the six tools with schemas", async () => {
    expect(client.getInstructions()).toContain("subscription");
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toStrictEqual(["browse", "check_auth", "generate_image", "get_result", "research", "set_auth", "web_search"]);
    for (const tool of tools) {
      expect(typeof tool.inputSchema).toBe("object");
      expect(typeof tool.outputSchema).toBe("object");
    }
  });

  it("web_search returns the answer and the sources as structured content", async () => {
    const result = await client.callTool({ name: "web_search", arguments: { query: "[[fake-agy:stream-answer]] latest Node LTS" } });
    expect(result.isError).not.toBe(true);
    const structured = result.structuredContent;
    expect(typeof structured.answer).toBe("string");
    expect(Array.isArray(structured.sources)).toBe(true);
  });

  it("research returns a report cut at a paragraph, with truncated set and the sources", async () => {
    const result = await client.callTool({
      name: "research",
      arguments: { topic: "[[fake-agy:stream-research-long]] a broad topic" },
    });
    expect(result.isError).not.toBe(true);
    const structured = result.structuredContent;
    expect(structured.truncated).toBe(true);
    expect(structured.report).toBe("Intro https://example.com/one");
    expect(structured.sources.map((source) => source.url)).toStrictEqual(["https://example.com/one"]);
  });

  it("browse returns its text and a PNG screenshot block", async () => {
    const result = await client.callTool({
      name: "browse",
      arguments: { task: "[[fake-agy:browse-screenshot]] read the title", url: "https://example.com", screenshot: true },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.hasScreenshot).toBe(true);
    const block = result.content.find((item) => item.type === "image");
    const bytes = Buffer.from(block?.data ?? "", "base64");
    expect([...bytes.subarray(0, PNG_SIGNATURE.length)]).toStrictEqual(PNG_SIGNATURE);
  });

  it("generate_image returns a PNG image block", async () => {
    const result = await client.callTool({
      name: "generate_image",
      arguments: { prompt: "[[fake-agy:image-png]] a red circle" },
    });
    expect(result.isError).not.toBe(true);
    const block = result.content.find((item) => item.type === "image");
    const bytes = Buffer.from(block?.data ?? "", "base64");
    expect([...bytes.subarray(0, PNG_SIGNATURE.length)]).toStrictEqual(PNG_SIGNATURE);
  });
});
