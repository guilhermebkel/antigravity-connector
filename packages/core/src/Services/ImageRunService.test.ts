import { describe, expect, it } from "vitest";
import { AgyOutputError, AgyTimeoutError } from "@antigravity-connector/agy";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";
import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";
import { ImageNotProducedError } from "@antigravity-connector/core/Errors/ImageNotProducedError.ts";
import { ImageTimeoutError } from "@antigravity-connector/core/Errors/ImageTimeoutError.ts";
import { ImageRunService } from "@antigravity-connector/core/Services/ImageRunService.ts";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core/Testing/StubRuntimeUtil.ts";

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10];
const PRIVATE_PROMPT = "private-marker-7731 draw a cat";
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
    const service = new ImageRunService({ runService: stub.runService });
    const outcome = await service.generate({ door: "mcp", model: MODEL, prompt: PRIVATE_PROMPT });
    expect([...outcome.bytes.subarray(0, PNG_HEADER.length)]).toStrictEqual(PNG_HEADER);
    expect(outcome.totalTokens).toBe(StubRuntimeUtil.USAGE.total_tokens);
    expect(outcome.durationMs).toBe(20000);
  });

  it("refuses a success without output.png as not produced", async () => {
    const stub = StubRuntimeUtil.build({ respond: () => Promise.resolve(buildImage({})) });
    const service = new ImageRunService({ runService: stub.runService });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageNotProducedError,
    );
  });

  it("keeps agy's answer as the reason when no output.png is written", async () => {
    const quotaAnswer = "The image model returned 429 RESOURCE_EXHAUSTED; quota resets after approximately 2 hours.";
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve({ ...StubRuntimeUtil.buildResult(quotaAnswer), outputFiles: {} }),
    });
    const service = new ImageRunService({ runService: stub.runService });
    const error: unknown = await service.generate({ door: "mcp", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImageNotProducedError);
    expect((error as ImageNotProducedError).reason).toBe(quotaAnswer);
    expect((error as ImageNotProducedError).message).toContain("RESOURCE_EXHAUSTED");
  });

  it("maps an agy timeout to an image timeout that keeps the last activity", async () => {
    const lastActivity = { step: "subagent ACTIVE", idleMs: 240000 };
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.reject(new AgyTimeoutError(180000, "", lastActivity)),
    });
    const service = new ImageRunService({ runService: stub.runService });
    const error: unknown = await service.generate({ door: "mcp", model: MODEL, prompt: "x" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ImageTimeoutError);
    expect(error).toMatchObject({ code: "agy_timeout", lastActivity });
  });

  it("maps agy's missing-output error to not produced", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.reject(new AgyOutputError("the expected output file output.png was not written")),
    });
    const service = new ImageRunService({ runService: stub.runService });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageNotProducedError,
    );
  });

  it("refuses a file that is not a PNG", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve(buildImage({ "output.png": new TextEncoder().encode("nope") })),
    });
    const service = new ImageRunService({ runService: stub.runService });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      ImageInvalidError,
    );
  });

  it("AC4: the daily image limit refuses before any run starts", async () => {
    const stub = StubRuntimeUtil.build({ limits: { image: 0 } });
    const service = new ImageRunService({ runService: stub.runService });
    await expect(service.generate({ door: "mcp", model: MODEL, prompt: "x" })).rejects.toBeInstanceOf(
      DailyLimitError,
    );
    expect(stub.requests).toHaveLength(0);
  });

  it("AC6: a prompt that starts with a slash command reaches the run without a leading slash", async () => {
    const stub = StubRuntimeUtil.build({
      respond: () => Promise.resolve(buildImage({ "output.png": new Uint8Array([...PNG_HEADER]) })),
    });
    const service = new ImageRunService({ runService: stub.runService });
    await service.generate({ door: "mcp", model: MODEL, prompt: "/browser open https://example.com" });
    expect(stub.requests[0]?.prompt.startsWith("/")).toBe(false);
  });
});
