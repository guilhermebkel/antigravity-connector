import { describe, expect, it } from "vitest";
import { MediaInputUtil } from "@antigravity-connector/core/Utils/MediaInputUtil.ts";

const buildHex = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "hex"));
const buildAscii = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "latin1"));
const buildFtyp = (brand: string): Uint8Array => new Uint8Array([
  ...buildHex("00000018"), ...buildAscii("ftyp"), ...buildAscii(brand), ...buildHex("00000000"),
]);
const buildRiff = (form: string): Uint8Array => new Uint8Array([
  ...buildAscii("RIFF"), ...buildHex("24000000"), ...buildAscii(form), ...buildHex("00000000"),
]);
const KINDS = ["image", "audio", "video"] as const;

describe("MediaInputUtil.detect", () => {
  it.each([
    ["MP3 with an ID3 tag", new Uint8Array([...buildAscii("ID3"), 4, 0, 0, 0]), "audio/mpeg", "mp3"],
    ["MP3 frame", buildHex("fffb9000"), "audio/mpeg", "mp3"],
    ["AAC (ADTS, MPEG-2)", buildHex("fff9508000"), "audio/aac", "aac"],
    ["AAC (ADTS)", buildHex("fff1508000"), "audio/aac", "aac"],
    ["WAV", buildRiff("WAVE"), "audio/wav", "wav"],
    ["OGG", new Uint8Array([...buildAscii("OggS"), 0, 2]), "audio/ogg", "ogg"],
    ["FLAC", new Uint8Array([...buildAscii("fLaC"), 0, 0]), "audio/flac", "flac"],
    ["M4A", buildFtyp("M4A "), "audio/mp4", "m4a"],
    ["WebM audio", buildHex("1a45dfa3"), "audio/webm", "webm"],
  ])("recognises %s as audio", (_name, bytes, mime, extension) => {
    expect(MediaInputUtil.detect(bytes, "audio")).toStrictEqual({ mime, extension });
  });

  it.each([
    ["MP4", buildFtyp("isom"), "video/mp4", "mp4"],
    ["QuickTime", buildFtyp("qt  "), "video/quicktime", "mov"],
    ["WebM", buildHex("1a45dfa3"), "video/webm", "webm"],
    ["AVI", buildRiff("AVI "), "video/x-msvideo", "avi"],
  ])("recognises %s as video", (_name, bytes, mime, extension) => {
    expect(MediaInputUtil.detect(bytes, "video")).toStrictEqual({ mime, extension });
  });

  it("recognises a PNG as an image", () => {
    const png = buildHex("89504e470d0a1a0a0000000d");
    expect(MediaInputUtil.detect(png, "image")).toStrictEqual({ mime: "image/png", extension: "png" });
  });

  it("refuses a WAV as a video and an AVI as audio", () => {
    const wavAsVideo = MediaInputUtil.detect(buildRiff("WAVE"), "video");
    const aviAsAudio = MediaInputUtil.detect(buildRiff("AVI "), "audio");
    expect(wavAsVideo).toBeUndefined();
    expect(aviAsAudio).toBeUndefined();
  });

  it("refuses text and an empty body for every kind", () => {
    const text = buildAscii("<html>not media</html>");
    for (const kind of KINDS) {
      const fromText = MediaInputUtil.detect(text, kind);
      const fromEmpty = MediaInputUtil.detect(new Uint8Array(), kind);
      expect(fromText).toBeUndefined();
      expect(fromEmpty).toBeUndefined();
    }
  });
});

describe("MediaInputUtil limits", () => {
  it("allows more bytes for audio and video than for an image, and bounds the route by the largest", () => {
    expect(MediaInputUtil.formatLimit("image")).toBe("4 MiB");
    expect(MediaInputUtil.formatLimit("audio")).toBe("20 MiB");
    expect(MediaInputUtil.formatLimit("video")).toBe("30 MiB");
    expect(MediaInputUtil.MAX_BYTES).toBe(MediaInputUtil.KIND_TO_MAX_BYTES.video);
  });
});
