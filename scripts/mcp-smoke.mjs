#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fileURLToPath } from "node:url";
import { API_KEY, DEFAULT_ENTRY, startServer, stopAllServers } from "./harness/ServerProcess.mjs";

export const REQUIRED_TOOLS = ["web_search", "generate_image"];

export const runMcpSmoke = async (entry = DEFAULT_ENTRY) => {
  const server = await startServer({ entry });
  try {
    const client = new Client({ name: "mcp-smoke", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${API_KEY}` } },
    }));
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    const missing = REQUIRED_TOOLS.filter((name) => !names.includes(name));
    await client.close();
    if (missing.length > 0) {
      throw new Error(`tools/list does not offer ${missing.join(", ")}`);
    }
    return names;
  } finally {
    await server.stop();
  }
};

const ARGUMENTS_OFFSET = 2;
const ENTRY_VALUE_OFFSET = 1;

const readEntryArgument = (argv) => {
  const index = argv.indexOf("--entry");
  return index === -1 ? DEFAULT_ENTRY : argv[index + ENTRY_VALUE_OFFSET] ?? DEFAULT_ENTRY;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argumentsList = process.argv.slice(ARGUMENTS_OFFSET);
  runMcpSmoke(readEntryArgument(argumentsList))
    .then((names) => {
      process.stdout.write(`mcp smoke ok: ${names.join(", ")}\n`);
    })
    .catch((error) => {
      process.stderr.write(`mcp smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    })
    .finally(stopAllServers);
}
