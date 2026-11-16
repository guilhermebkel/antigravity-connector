import { describe, expect, it } from "vitest";
import { ImageSourceService } from "@antigravity-connector/core/Services/ImageSourceService.ts";
import { RemoteImageError } from "@antigravity-connector/core/Errors/RemoteImageError.ts";
import { StubImageDownloadUtil } from "@antigravity-connector/core/Testing/StubImageDownloadUtil.ts";

const PNG_BYTES = new Uint8Array(Buffer.from("89504e470d0a1a0a0000000d", "hex"));
const JPEG_BYTES = new Uint8Array(Buffer.from("ffd8ffe000104a46", "hex"));
const TEXT_BYTES = new Uint8Array(Buffer.from("<html>not a picture</html>"));
const FAKE_SECRET = "secret-token-9f31c2";
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;

type ServiceFixture = {
  service: ImageSourceService;
  downloads: StubImageDownloadUtil;
};

const PHOTO_URL = "https://cdn.example.com/photo.png";

const buildService = (respond: (url: URL) => Promise<Uint8Array>): ServiceFixture => {
  const downloads = new StubImageDownloadUtil(respond);
  return { service: new ImageSourceService({ downloader: downloads }), downloads };
};

describe("ImageSourceService", () => {
  it("names an https image by its position and by the type of its bytes, not by its address", async () => {
    const { service, downloads } = buildService(() => Promise.resolve(JPEG_BYTES));
    const attachments = await service.readAttachments([PHOTO_URL]);
    expect(attachments).toStrictEqual([{ fileName: "attachment-1.jpg", bytes: JPEG_BYTES }]);
    expect(downloads.urls).toStrictEqual([PHOTO_URL]);
  });

  it("keeps a data URL and an https URL in the order the caller gave", async () => {
    const { service } = buildService(() => Promise.resolve(JPEG_BYTES));
    const attachments = await service.readAttachments([PNG_DATA_URL, "https://cdn.example.com/b", PNG_DATA_URL]);
    expect(attachments.map((attachment) => attachment.fileName)).toStrictEqual([
      "attachment-1.png",
      "attachment-2.jpg",
      "attachment-3.png",
    ]);
  });

  it("downloads nothing for a call that holds only data URLs", async () => {
    const { service, downloads } = buildService(() => Promise.resolve(PNG_BYTES));
    await service.readAttachments([PNG_DATA_URL]);
    expect(downloads.urls).toStrictEqual([]);
  });

  it.each([
    ["http://cdn.example.com/a.png", "not_https"],
    ["ftp://cdn.example.com/a.png", "not_https"],
    ["nonsense", "invalid_url"],
  ])("refuses %s before anything is downloaded", async (url, reason) => {
    const { service, downloads } = buildService(() => Promise.resolve(PNG_BYTES));
    await expect(service.readAttachments([url])).rejects.toMatchObject({ reason });
    expect(downloads.urls).toStrictEqual([]);
  });

  it("refuses bytes that are not a picture, whatever the address ends with", async () => {
    const { service } = buildService(() => Promise.resolve(TEXT_BYTES));
    await expect(service.readAttachments([PHOTO_URL])).rejects.toMatchObject({ reason: "not_an_image" });
  });

  it("tells which reference image failed, counting from one", async () => {
    const failingPaths = new Set(["/bad"]);
    const { service } = buildService((url) => {
      return failingPaths.has(url.pathname) ? Promise.reject(new RemoteImageError("redirect")) : Promise.resolve(PNG_BYTES);
    });
    await expect(service.readAttachments(["https://cdn.example.com/ok", "https://cdn.example.com/bad"]))
      .rejects.toThrow(/^Reference image 2 redirects more than 3 times/);
  });

  it("passes through an error that is not a remote image error, such as a cancel", async () => {
    const cancel = new Error("cancelled by the client");
    const { service } = buildService(() => Promise.reject(cancel));
    await expect(service.readAttachments(["https://cdn.example.com/a"])).rejects.toBe(cancel);
  });

  it.each([
    ["http://cdn.example.com/a.png?token=SECRET"],
    ["https://user:SECRET@cdn.example.com/a.png"],
    ["https://cdn.example.com/a.png?token=SECRET"],
  ])("keeps the secret in %s out of the error text", async (template) => {
    const url = template.replace("SECRET", FAKE_SECRET);
    const { service } = buildService(() => Promise.reject(new RemoteImageError("unreachable")));
    const failure = await service.readAttachments([url]).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RemoteImageError);
    expect((failure as RemoteImageError).message).not.toContain(FAKE_SECRET);
    expect((failure as RemoteImageError).message).not.toContain("cdn.example.com");
  });
});
