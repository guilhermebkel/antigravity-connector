import { randomBytes } from "node:crypto";
import type {
  ImageUploadLink,
  ImageUploadReceipt,
  UploadedImage,
} from "@antigravity-connector/core/Protocols/ImageUploadProtocol.ts";
import { ImageUploadError } from "@antigravity-connector/core/Errors/ImageUploadError.ts";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";

export type ImageUploadServiceOptions = { clock: () => number };

type PendingLink = {
  imageId: string;
  expiresAtMs: number;
};

type StoredImage = {
  image: UploadedImage;
  expiresAtMs: number;
};

export class ImageUploadService {
  static readonly MS_PER_SECOND = 1000;

  static readonly LINK_TTL_SECONDS = 300;

  static readonly IMAGE_TTL_SECONDS = 900;

  static readonly MAX_ENTRIES = 8;

  static readonly TOKEN_BYTES = 32;

  static readonly IMAGE_ID_BYTES = 16;

  private readonly clock: () => number;

  private readonly tokenToLink = new Map<string, PendingLink>();

  private readonly imageIdToStored = new Map<string, StoredImage>();

  constructor(options: ImageUploadServiceOptions) {
    this.clock = options.clock;
  }

  createLink(): ImageUploadLink {
    this.removeExpired();
    if (this.tokenToLink.size + this.imageIdToStored.size >= ImageUploadService.MAX_ENTRIES) {
      throw new ImageUploadError("too_many_links");
    }
    const token = randomBytes(ImageUploadService.TOKEN_BYTES).toString("base64url");
    const imageId = randomBytes(ImageUploadService.IMAGE_ID_BYTES).toString("base64url");
    const expiresAtMs = this.clock() + ImageUploadService.LINK_TTL_SECONDS * ImageUploadService.MS_PER_SECOND;
    this.tokenToLink.set(token, { imageId, expiresAtMs });
    return { token, imageId, expiresInSeconds: ImageUploadService.LINK_TTL_SECONDS };
  }

  hasLink(token: string): boolean {
    this.removeExpired();
    return this.tokenToLink.has(token);
  }

  accept(token: string, bytes: Uint8Array): ImageUploadReceipt {
    this.removeExpired();
    const link = this.tokenToLink.get(token);
    if (link === undefined) {
      throw new ImageUploadError("unknown_link");
    }
    if (bytes.byteLength > ImageInputUtil.MAX_IMAGE_BYTES) {
      throw new ImageUploadError("too_large");
    }
    const mime = ImageInputUtil.detectMime(bytes);
    if (mime === undefined) {
      throw new ImageUploadError("not_an_image");
    }
    this.tokenToLink.delete(token);
    const expiresAtMs = this.clock() + ImageUploadService.IMAGE_TTL_SECONDS * ImageUploadService.MS_PER_SECOND;
    this.imageIdToStored.set(link.imageId, { image: { mime, bytes }, expiresAtMs });
    return { mime, imageId: link.imageId, sizeBytes: bytes.byteLength };
  }

  readImage(imageId: string): UploadedImage {
    this.removeExpired();
    const stored = this.imageIdToStored.get(imageId);
    if (stored === undefined) {
      throw new ImageUploadError("image_not_found");
    }
    return stored.image;
  }

  private removeExpired(): void {
    const now = this.clock();
    for (const [token, link] of this.tokenToLink) {
      if (link.expiresAtMs <= now) {
        this.tokenToLink.delete(token);
      }
    }
    for (const [imageId, stored] of this.imageIdToStored) {
      if (stored.expiresAtMs <= now) {
        this.imageIdToStored.delete(imageId);
      }
    }
  }
}
