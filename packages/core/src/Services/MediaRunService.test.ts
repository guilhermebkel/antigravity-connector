import { describe, expect, it } from "vitest";
import { MediaUploadError } from "@antigravity-connector/core/Errors/MediaUploadError.ts";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";
import { MediaUploadService } from "@antigravity-connector/core/Services/MediaUploadService.ts";
import { MediaRunService } from "@antigravity-connector/core/Services/MediaRunService.ts";
import { StubRuntimeUtil } from "@antigravity-connector/core/Testing/StubRuntimeUtil.ts";
import { UploadReferenceUtil } from "@antigravity-connector/core/Utils/UploadReferenceUtil.ts";

const MODEL = "gemini-3.8-flash";
const PRIVATE_PROMPT = "private-marker-7731 what is said?";
const MP4_BYTES = new Uint8Array(Buffer.from("0000001866747970697361300000000000", "hex"));
const MP3_BYTES = new Uint8Array(Buffer.from("494433040000", "hex"));

const buildService = (options: Parameters<typeof StubRuntimeUtil.build>[0] = {}) => {
  const stub = StubRuntimeUtil.build(options);
  const uploads = new MediaUploadService({ clock: () => 0 });
  const service = new MediaRunService({ runService: stub.runService, uploads });
  return { stub, uploads, service };
};

const upload = (uploads: MediaUploadService, kind: "audio" | "video", bytes: Uint8Array): string => {
  const link = uploads.createLink(kind);
  uploads.accept(link.token, bytes);
  return UploadReferenceUtil.build(link.imageId);
};

describe("MediaRunService", () => {
  it("runs the media kind with the upload as an attachment named by its type, and returns the text", async () => {
    const { stub, uploads, service } = buildService({ answer: "The clip shows a cat." });
    const file = upload(uploads, "video", MP4_BYTES);
    const outcome = await service.run({ file, door: "mcp", kind: "video", model: MODEL, prompt: PRIVATE_PROMPT, source: "analyse_video" });

    expect(outcome.text).toBe("The clip shows a cat.");
    expect(outcome.totalTokens).toBe(StubRuntimeUtil.USAGE.total_tokens);
    expect(stub.requests).toHaveLength(1);
    expect(stub.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.mp4"]);
    expect(stub.requests[0]?.prompt).toContain("attached audio or video file");
  });

  it("reads an audio upload as audio", async () => {
    const { stub, uploads, service } = buildService();
    const file = upload(uploads, "audio", MP3_BYTES);
    await service.run({ file, door: "mcp", kind: "audio", model: MODEL, prompt: "x", source: "transcribe_audio" });
    expect(stub.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.mp3"]);
  });

  it("refuses a file uploaded as the other kind before any run starts", async () => {
    const { stub, uploads, service } = buildService();
    const file = upload(uploads, "audio", MP3_BYTES);
    const attempt = service.run({ file, door: "mcp", kind: "video", model: MODEL, prompt: "x", source: "analyse_video" });
    await expect(attempt).rejects.toMatchObject({ reason: "wrong_kind" });
    expect(stub.requests).toHaveLength(0);
  });

  it("refuses a value that is not an upload reference and an upload that is gone", async () => {
    const { stub, uploads, service } = buildService();
    const gone = UploadReferenceUtil.build(uploads.createLink("video").imageId);
    for (const file of ["https://example.com/a.mp4", gone]) {
      const attempt = service.run({ file, door: "mcp", kind: "video", model: MODEL, prompt: "x", source: "analyse_video" });
      await expect(attempt).rejects.toBeInstanceOf(MediaUploadError);
    }
    expect(stub.requests).toHaveLength(0);
  });

  it("counts against the media limit and refuses over it without a run", async () => {
    const { stub, uploads, service } = buildService({ limits: { media: 1 } });
    const file = upload(uploads, "video", MP4_BYTES);
    const input = { file, door: "mcp" as const, kind: "video" as const, model: MODEL, prompt: "x", source: "analyse_video" };
    await service.run(input);
    await expect(service.run(input)).rejects.toBeInstanceOf(DailyLimitError);
    expect(stub.requests).toHaveLength(1);
  });

  it("never writes the prompt or the answer to the call log", async () => {
    const { stub, uploads, service } = buildService({ answer: "secret answer 55" });
    const file = upload(uploads, "video", MP4_BYTES);
    await service.run({ file, door: "mcp", kind: "video", model: MODEL, prompt: PRIVATE_PROMPT, source: "analyse_video" });
    expect(JSON.stringify(stub.callLog)).not.toContain("private-marker-7731");
    expect(JSON.stringify(stub.callLog)).not.toContain("secret answer 55");
  });
});
