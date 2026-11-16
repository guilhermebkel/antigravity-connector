import { describe, expect, it } from "vitest";
import { ImageUploadService } from "@antigravity-connector/core/Services/ImageUploadService.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const JPEG_BYTES = new Uint8Array(Buffer.from("ffd8ffe000104a46", "hex"));
const WEBP_BYTES = new Uint8Array(Buffer.from("52494646240000005745425056503820", "hex"));
const TEXT_BYTES = new Uint8Array(Buffer.from("<html>not a picture</html>"));
const FOUR_MIB = 4194304;
const LINK_LIFETIME_MS = 300000;
const IMAGE_LIFETIME_MS = 900000;
const ENTRY_LIMIT = 8;

type ServiceFixture = {
  service: ImageUploadService;
  clock: { now: number };
};

const buildService = (): ServiceFixture => {
  const clock = { now: 1000 };
  return { service: new ImageUploadService({ clock: () => clock.now }), clock };
};

const buildBytes = (byteLength: number): Uint8Array => {
  const bytes = new Uint8Array(byteLength);
  bytes.set(PNG_BYTES);
  return bytes;
};

describe("ImageUploadService", () => {
  it("stores an uploaded picture under the image id the link announced, and reads it back", () => {
    const { service } = buildService();
    const link = service.createLink();
    const receipt = service.accept(link.token, PNG_BYTES);
    expect(receipt).toStrictEqual({ imageId: link.imageId, mime: "image/png", sizeBytes: 12 });
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
    expect(() => service.readImage(link.imageId)).toThrow(/^A reference image points to an upload that was not found/);
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
    expect(() => service.readImage(link.imageId)).toThrow(/^A reference image points to an upload that was not found/);
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
});
