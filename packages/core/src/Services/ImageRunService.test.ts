import { describe, expect, it } from "vitest";
import { AgyOutputError, AgyTimeoutError } from "@antigravity-connector/agy";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";
import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";
import { ImageNotProducedError } from "@antigravity-connector/core/Errors/ImageNotProducedError.ts";
import { ImageTimeoutError } from "@antigravity-connector/core/Errors/ImageTimeoutError.ts";
import { ImageRunService } from "@antigravity-connector/core/Services/ImageRunService.ts";
import { ImageQuotaService } from "@antigravity-connector/core/Services/ImageQuotaService.ts";
import { ImageQuotaError } from "@antigravity-connector/core/Errors/ImageQuotaError.ts";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core/Testing/StubRuntimeUtil.ts";

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10];
const PRIVATE_PROMPT = "private-marker-7731 draw a cat";
const buildQuota = (): ImageQuotaService => new ImageQuotaService({ clock: () => 0 });
const MODEL = "gemini-3.8-flash";

type OutputFileNameToBytes = Record<string, Uint8Array>;

const buildImage = (outputFiles: OutputFileNameToBytes): StubRunResult => ({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles,
});

describe("ImageRunService", () => {
  it("returns the PNG bytes of output.png with the usage and the duration", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve(buildImage({ "output.png": new Uint8Array([...PNG_HEADER, 1]) })),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    const outcome = await service.generate({ door: "mcp", model: MODEL, prompt: PRIVATE_PROMPT });
    expect([...outcome.bytes.subarray(0, PNG_HEADER.length)]).toStrictEqual(PNG_HEADER);
    expect(outcome.totalTokens).toBe(StubRuntimeUtil.USAGE.total_tokens);
    expect(outcome.durationMs).toBe(20000);
  });

  it("refuses a success without output.png as not produced", async () => {
    const stub = StubRuntimeUtil.build({ respond: () => Promise.resolve(buildImage({})) });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageNotProducedError,
    );
  });

  it("keeps agy's answer as the reason when no output.png is written", async () => {
    const quotaAnswer = "The image is still being made. I will notify you when it is ready.";
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve({ ...StubRuntimeUtil.buildResult(quotaAnswer), outputFiles: {} }),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    const error: unknown = await service.generate({ door: "mcp", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImageNotProducedError);
    expect((error as ImageNotProducedError).reason).toBe(quotaAnswer);
    expect((error as ImageNotProducedError).message).toContain("I will notify you when it is ready");
  });

  it("maps an agy timeout to an image timeout that keeps the last activity", async () => {
    const lastActivity = { step: "subagent ACTIVE", idleMs: 240000 };
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.reject(new AgyTimeoutError(180000, "", lastActivity)),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    const error: unknown = await service.generate({ door: "mcp", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ImageTimeoutError);
    expect(error).toMatchObject({ code: "agy_timeout", lastActivity });
  });

  it("maps agy's missing-output error to not produced", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.reject(new AgyOutputError("the expected output file output.png was not written")),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageNotProducedError,
    );
  });

  it("refuses a file that is not a PNG", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve(buildImage({ "output.png": new TextEncoder().encode("nope") })),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageInvalidError,
    );
  });

  it("AC4: the daily image limit refuses before any run starts", async () => {
    const stub = StubRuntimeUtil.build({ limits: { image: 0 } });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      DailyLimitError,
    );
    expect(stub.requests).toHaveLength(0);
  });

  it("AC6: a prompt that starts with a slash command reaches the run without a leading slash", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve(buildImage({ "output.png": new Uint8Array([...PNG_HEADER]) })),
    });
    const service = new ImageRunService({ runService: stub.runService, quota: buildQuota() });
    await service.generate({ door: "mcp", model: MODEL, prompt: "/browser open https://example.com" });
    expect(stub.requests[0]?.prompt.startsWith("/")).toBe(false);
  });

  describe("the image quota gate", () => {
    const QUOTA_ANSWER = "RESOURCE_EXHAUSTED (429): quota will reset after 1h0m0s.";

    it("refuses calls after a quota answer until the reset time, without running agy", async () => {
      const clock = { now: 0 };
      let answer = QUOTA_ANSWER;
      const stub = StubRuntimeUtil.build({
        respond: () => Promise.resolve({ ...StubRuntimeUtil.buildResult(answer), outputFiles: {} }),
      });
      const quota = new ImageQuotaService({ clock: () => clock.now });
      const service = new ImageRunService({ runService: stub.runService, quota });

      const first = await service.generate({ door: "api", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);
      expect(first).toBeInstanceOf(ImageQuotaError);
      clock.now = 1000;
      const refused = await service.generate({ door: "api", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);
      expect(refused).toBeInstanceOf(ImageQuotaError);
      expect(refused).toMatchObject({ code: "image_quota_exhausted", resetAt: "1970-01-01T01:00:00.000Z" });
      expect(stub.requests).toHaveLength(1);

      clock.now = 3600000;
      answer = "";
      await expect(service.generate({ door: "api", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
        ImageNotProducedError,
      );
      expect(stub.requests).toHaveLength(2);
    });

    it("does not start the quota cooldown for an answer that is not about quota", async () => {
      const stub = StubRuntimeUtil.build({
        respond: () => Promise.resolve({ ...StubRuntimeUtil.buildResult("Here is your cat."), outputFiles: {} }),
      });
      const quota = new ImageQuotaService({ clock: () => 0 });
      const service = new ImageRunService({ runService: stub.runService, quota });

      await expect(service.generate({ door: "api", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
        ImageNotProducedError,
      );
      expect(() => {
        quota.assertAvailable();
      }).not.toThrow();
    });
  });
});
