import { describe, expect, it } from "vitest";
import { MediaUploadService } from "@antigravity-connector/core/Services/MediaUploadService.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const JPEG_BYTES = new Uint8Array(Buffer.from("ffd8ffe000104a46", "hex"));
const WEBP_BYTES = new Uint8Array(Buffer.from("52494646240000005745425056503820", "hex"));
const TEXT_BYTES = new Uint8Array(Buffer.from("<html>not a picture</html>"));
const FOUR_MIB = 4194304;
const LINK_LIFETIME_MS = 300000;
const IMAGE_LIFETIME_MS = 900000;
const ENTRY_LIMIT = 8;

type ServiceFixture = {
  service: MediaUploadService;
  clock: { now: number };
};

const buildService = (): ServiceFixture => {
  const clock = { now: 1000 };
  return { service: new MediaUploadService({ clock: () => clock.now }), clock };
};

const buildBytes = (byteLength: number): Uint8Array => {
  const bytes = new Uint8Array(byteLength);
  bytes.set(PNG_BYTES);
  return bytes;
};

describe("MediaUploadService", () => {
  it("stores an uploaded picture under the image id the link announced, and reads it back", () => {
    const { service } = buildService();
    const link = service.createLink();
    const receipt = service.accept(link.token, PNG_BYTES);
    expect(receipt).toStrictEqual({ imageId: link.imageId, kind: "image", mime: "image/png", sizeBytes: 12 });
    expect(service.readImage(link.imageId)).toStrictEqual({ mime: "image/png", bytes: PNG_BYTES });
  });

  it("tells the link lifetime in seconds", () => {
    const { service } = buildService();
    expect(service.createLink().expiresInSeconds).toBe(300);
  });

  it("gives every link its own token and image id, and never reuses the token as the image id", () => {
    const { service } = buildService();
    const first = service.createLink();
    const second = service.createLink();
    expect(new Set([first.token, second.token, first.imageId, second.imageId]).size).toBe(4);
  });

  it.each([
    ["PNG", PNG_BYTES, "image/png"],
    ["JPEG", JPEG_BYTES, "image/jpeg"],
    ["WebP", WEBP_BYTES, "image/webp"],
  ])("detects a %s picture by its bytes", (_name, bytes, mime) => {
    const { service } = buildService();
    const link = service.createLink();
    expect(service.accept(link.token, bytes).mime).toBe(mime);
  });

  it("works only once: the same token is unknown after a successful upload", () => {
    const { service } = buildService();
    const link = service.createLink();
    service.accept(link.token, PNG_BYTES);
    expect(() => service.accept(link.token, PNG_BYTES)).toThrow(/^The upload link is unknown, expired or already used/);
    expect(service.hasLink(link.token)).toBe(false);
  });

  it("refuses a token it never issued", () => {
    const { service } = buildService();
    expect(service.hasLink("never-issued")).toBe(false);
    expect(() => service.accept("never-issued", PNG_BYTES)).toThrow(/^The upload link is unknown/);
  });

  it("keeps the link after a file that is not a picture, so the right file can follow", () => {
    const { service } = buildService();
    const link = service.createLink();
    expect(() => service.accept(link.token, TEXT_BYTES)).toThrow(/^The uploaded file is not a PNG, JPEG or WebP picture/);
    expect(service.hasLink(link.token)).toBe(true);
    expect(service.accept(link.token, PNG_BYTES).mime).toBe("image/png");
  });

  it("refuses an empty body as not a picture", () => {
    const { service } = buildService();
    const link = service.createLink();
    expect(() => service.accept(link.token, new Uint8Array())).toThrow(/^The uploaded file is not a PNG/);
  });

  it("accepts a file of exactly 4 MiB and refuses one byte more, keeping the link", () => {
    const { service } = buildService();
    const link = service.createLink();
    expect(() => service.accept(link.token, buildBytes(FOUR_MIB + 1))).toThrow(/^The uploaded file is larger than 4 MiB/);
    expect(service.accept(link.token, buildBytes(FOUR_MIB)).sizeBytes).toBe(FOUR_MIB);
  });

  it("expires a link after 5 minutes, and not one millisecond before", () => {
    const { service, clock } = buildService();
    const link = service.createLink();
    clock.now += LINK_LIFETIME_MS - 1;
    expect(service.hasLink(link.token)).toBe(true);
    clock.now += 1;
    expect(service.hasLink(link.token)).toBe(false);
    expect(() => service.accept(link.token, PNG_BYTES)).toThrow(/^The upload link is unknown, expired or already used/);
  });

  it("keeps an uploaded picture for 15 minutes from the upload, and then forgets it", () => {
    const { service, clock } = buildService();
    const link = service.createLink();
    clock.now += LINK_LIFETIME_MS - 1;
    service.accept(link.token, PNG_BYTES);
    clock.now += IMAGE_LIFETIME_MS - 1;
    expect(service.readImage(link.imageId).mime).toBe("image/png");
    clock.now += 1;
    expect(() => service.readImage(link.imageId)).toThrow(/^A file reference points to an upload that was not found/);
  });

  it("lets the same uploaded picture be read by more than one call", () => {
    const { service } = buildService();
    const link = service.createLink();
    service.accept(link.token, JPEG_BYTES);
    expect(service.readImage(link.imageId)).toStrictEqual(service.readImage(link.imageId));
  });

  it("refuses an image id that was announced but never uploaded", () => {
    const { service } = buildService();
    const link = service.createLink();
    expect(() => service.readImage(link.imageId)).toThrow(/^A file reference points to an upload that was not found/);
  });

  it("refuses a ninth link while eight links and pictures wait, counting both", () => {
    const { service } = buildService();
    const links = Array.from({ length: ENTRY_LIMIT }, () => service.createLink());
    service.accept(links[0]?.token ?? "", PNG_BYTES);
    expect(() => service.createLink()).toThrow(/^Too many uploads are waiting/);
  });

  it("makes room again when waiting entries expire", () => {
    const { service, clock } = buildService();
    Array.from({ length: ENTRY_LIMIT }, () => service.createLink());
    clock.now += LINK_LIFETIME_MS;
    expect(service.createLink().expiresInSeconds).toBe(300);
  });

  describe("audio and video links", () => {
    const MP4_BYTES = new Uint8Array(Buffer.from("0000001866747970697361300000000000", "hex"));
    const MP3_BYTES = new Uint8Array(Buffer.from("494433040000", "hex"));
    const TWENTY_MIB = 20971520;
    const THIRTY_MIB = 31457280;

    it("announces the kind and its size limit on the link", () => {
      const { service } = buildService();
      expect(service.createLink("video")).toMatchObject({ kind: "video", maxBytes: THIRTY_MIB });
      expect(service.createLink("audio")).toMatchObject({ kind: "audio", maxBytes: TWENTY_MIB });
      expect(service.createLink()).toMatchObject({ kind: "image", maxBytes: FOUR_MIB });
    });

    it("keeps the detected type and the extension of an uploaded video", () => {
      const { service } = buildService();
      const link = service.createLink("video");
      expect(service.accept(link.token, MP4_BYTES)).toMatchObject({ kind: "video", mime: "video/mp4" });
      expect(service.readMedia(link.imageId, "video")).toMatchObject({ extension: "mp4", mime: "video/mp4" });
    });

    it("refuses bytes that do not match the kind of the link, keeping the link", () => {
      const { service } = buildService();
      const link = service.createLink("video");
      expect(() => service.accept(link.token, MP3_BYTES)).toThrow(/^The uploaded file is not a MP4, MOV, WebM or AVI video file/);
      expect(service.hasLink(link.token)).toBe(true);
    });

    it("refuses a picture on an audio link, and audio on an image link", () => {
      const { service } = buildService();
      expect(() => service.accept(service.createLink("audio").token, PNG_BYTES)).toThrow(/audio file/);
      expect(() => service.accept(service.createLink().token, MP3_BYTES)).toThrow(/PNG, JPEG or WebP/);
    });

    it("refuses a video over its own limit, not the image limit", () => {
      const { service } = buildService();
      const link = service.createLink("video");
      const big = new Uint8Array(THIRTY_MIB + 1);
      big.set(MP4_BYTES);
      expect(() => service.accept(link.token, big)).toThrow(/^The uploaded file is larger than 30 MiB/);
      const fits = new Uint8Array(FOUR_MIB + 1);
      fits.set(MP4_BYTES);
      expect(service.accept(link.token, fits).sizeBytes).toBe(FOUR_MIB + 1);
    });

    it("reads a file only as the kind it was uploaded as", () => {
      const { service } = buildService();
      const link = service.createLink("audio");
      service.accept(link.token, MP3_BYTES);
      expect(() => service.readMedia(link.imageId, "video")).toThrow(/^The upload is not a video file/);
      expect(() => service.readImage(link.imageId)).toThrow(/^The upload is not a picture/);
    });

    it("refuses an upload that would pass the memory cap, keeping the link", () => {
      const { service } = buildService();
      const big = new Uint8Array(THIRTY_MIB);
      big.set(MP4_BYTES);
      service.accept(service.createLink("video").token, big);
      service.accept(service.createLink("video").token, big);
      const third = service.createLink("video");
      expect(() => service.accept(third.token, big)).toThrow(/^Too many uploads are waiting/);
      expect(service.hasLink(third.token)).toBe(true);
    });
  });
});
