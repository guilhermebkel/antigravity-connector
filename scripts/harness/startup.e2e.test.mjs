import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startServer, stopAllServers } from "./ServerProcess.mjs";

describe("starting the built server", () => {
  it("AC2: a bundle that fails to start fails the test with the server's stderr", async () => {
    await expect(startServer({ env: { HOST: "0.0.0.0" } })).rejects.toThrow(/127\.0\.0\.1:8787:8787/);
  });

  it("AC4: a server that is still running when the suite ends is stopped", async () => {
    const server = await startServer();
    expect(server.child.exitCode).toBeNull();
    await stopAllServers();
    expect(server.child.exitCode !== null || server.child.signalCode !== null).toBe(true);
  });

  it("refuses to start when the bundle has not been built", async () => {
    const scratchRoot = join(tmpdir(), "e2e-missing-");
    const scratch = mkdtempSync(scratchRoot);
    try {
      await expect(startServer({ entry: join(scratch, "main.mjs") })).rejects.toThrow(/Run pnpm build first/);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
