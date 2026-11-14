import { describe, expect, it } from "vitest";
import { ImageRunService, StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ImageGenerationService } from "@antigravity-connector/api/Services/ImageGenerationService.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const CLOCK_MS = 1700000000000;

const buildPngResult = (): Promise<StubRunResult> => Promise.resolve({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles: { "output.png": PNG_BYTES },
});

const buildService = (respond: () => Promise<StubRunResult> = buildPngResult) => {
  const stub = StubRuntimeUtil.build({ respond });
  const service = new ImageGenerationService({
    imageService: new ImageRunService({ runService: stub.runService }),
    clock: () => CLOCK_MS,
  });
  return { stub, service };
};

describe("ImageGenerationService", () => {
  it("AC1: a prompt returns the PNG as base64 in data[0].b64_json", async () => {
    const { service } = buildService();
    const outcome = await service.generate({ prompt: "a red circle" });
    const bytes = Buffer.from(outcome.body.data[0]?.b64_json ?? "", "base64");

    expect(bytes).toStrictEqual(Buffer.from(PNG_BYTES));
    expect(outcome.body.created).toBe(CLOCK_MS / 1000);
  });

  it("AC2: n other than 1 is refused and names n", () => {
    const request = { prompt: "x", n: 2 };

    expect(() => {
      ImageGenerationService.checkRequest(request);
    }).toThrow(ApiRequestError);
    expect(() => {
      ImageGenerationService.checkRequest(request);
    }).toThrow(/n must be 1/);
  });

  it("AC4: response_format url is refused", () => {
    const request = { prompt: "x", response_format: "url" };

    expect(() => {
      ImageGenerationService.checkRequest(request);
    }).toThrow(/b64_json/);
  });

  it("S2: size and style are ignored and listed", async () => {
    const { service } = buildService();
    const outcome = await service.generate({ prompt: "x", size: "1024x1024", style: "vivid" });

    expect(outcome.ignoredParams).toStrictEqual(["size", "style"]);
  });

  it("AC5: a run that writes no file fails with agy_failed", async () => {
    const { service } = buildService(() => Promise.resolve(StubRuntimeUtil.buildResult("no file")));
    const error: unknown = await service.generate({ prompt: "x" }).then(() => undefined, (caught: unknown) => caught);

    expect(error).toMatchObject({ code: "agy_failed" });
  });
});
