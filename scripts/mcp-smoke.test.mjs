import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runMcpSmoke } from "./mcp-smoke.mjs";

const HEALTH_ONLY_SERVER = [
  "import { createServer } from 'node:http';",
  "createServer((request, response) => {",
  "  if (request.url === '/health') { response.end('{\"status\":\"ok\",\"agy\":\"connected\"}'); return; }",
  "  response.statusCode = 404; response.end();",
  "}).listen(Number(process.env.PORT), '127.0.0.1');",
  "",
].join("\n");

describe("pnpm smoke", () => {
  it("AC3: a build whose /mcp route is missing fails the smoke check", async () => {
    const scratchRoot = join(tmpdir(), "smoke-");
    const scratch = mkdtempSync(scratchRoot);
    const entry = join(scratch, "health-only.mjs");
    writeFileSync(entry, HEALTH_ONLY_SERVER);
    try {
      await expect(runMcpSmoke(entry)).rejects.toThrow(/Error POSTing to endpoint/);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
