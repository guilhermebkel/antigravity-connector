import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyCliAdapter } from "@antigravity-connector/agy/Adapters/AgyCliAdapter.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgyUsageAdapter } from "@antigravity-connector/agy/Adapters/AgyUsageAdapter.ts";
import type { AgyRunRequest, AgyRunResult } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

const USAGE = { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 0 };

const buildAdapter = (response: string) => {
  const requests: AgyRunRequest[] = [];
  const runner = {
    requests,
    run: (request: AgyRunRequest): Promise<AgyRunResult> => {
      requests.push(request);
      return Promise.resolve({
        envelope: { response, conversation_id: "", status: "SUCCESS" as const, usage: USAGE },
        outputFiles: {},
      });
    },
    stream: () => (async function* empty() {
      await Promise.resolve();
      yield* [];
    })(),
  };
  const adapter = new AgyUsageAdapter({ runner, modelSlug: "gemini-3.8-flash-low", timeoutMs: 5000 });
  return { adapter, requests };
};

describe("AgyUsageAdapter", () => {
  it("asks agy for its /usage command in plan mode and parses the table", async () => {
    const { adapter, requests } = buildAdapter("Gemini Models\tWeekly Limit Remaining\t99%\t2026-12-04T09:39:33Z\n");
    const report = await adapter.read();

    expect(requests[0]?.prompt).toBe("/usage");
    expect(requests[0]?.profile.isPlanMode).toBe(true);
    expect(report.buckets[0]).toMatchObject({ group: "Gemini Models", window: "weekly", remainingPercent: 99 });
  });

  it("refuses an answer that is not a usage table", async () => {
    const { adapter } = buildAdapter("hello");
    await expect(adapter.read()).rejects.toBeInstanceOf(AgyOutputError);
  });

  describe("with the fake agy binary", () => {
    const FAKE_BINARY = resolve(import.meta.dirname, "../Testing/FakeAgy.mjs");
    let tempRoot = "";

    beforeEach(() => {
      const prefix = join(tmpdir(), "agy-usage-test-");
      tempRoot = mkdtempSync(prefix);
      chmodSync(FAKE_BINARY, 0o755);
    });

    afterEach(() => {
      rmSync(tempRoot, { recursive: true, force: true });
    });

    it("reads the usage table the fake prints for /usage", async () => {
      const parentEnv = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: tempRoot, LANG: "C.UTF-8" };
      const runner = new AgyCliAdapter({ binaryPath: FAKE_BINARY, tempRoot, parentEnv });
      const adapter = new AgyUsageAdapter({ runner, modelSlug: "gemini-3.8-flash-low", timeoutMs: 20000 });
      const report = await adapter.read();

      expect(report.buckets).toHaveLength(4);
      expect(report.buckets[1]).toMatchObject({ window: "five_hour", remainingPercent: 42 });
    });
  });
});
