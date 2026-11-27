import { randomBytes } from "node:crypto";
import type {
  MediaUploadLink,
  MediaUploadReceipt,
  UploadedImage,
  UploadedMedia,
} from "@antigravity-connector/core/Protocols/MediaUploadProtocol.ts";
import type { ImageMime } from "@antigravity-connector/core/Protocols/ImageInputProtocol.ts";
import type { MediaKind } from "@antigravity-connector/core/Protocols/MediaProtocol.ts";
import { MediaUploadError } from "@antigravity-connector/core/Errors/MediaUploadError.ts";
import { MediaInputUtil } from "@antigravity-connector/core/Utils/MediaInputUtil.ts";

export type MediaUploadServiceOptions = { clock: () => number };

type PendingLink = {
  imageId: string;
  kind: MediaKind;
  expiresAtMs: number;
};

type StoredImage = {
  media: UploadedMedia;
  expiresAtMs: number;
};

export class MediaUploadService {
  static readonly MS_PER_SECOND = 1000;

  static readonly LINK_TTL_SECONDS = 300;

  static readonly IMAGE_TTL_SECONDS = 900;

  static readonly MAX_ENTRIES = 8;

  static readonly STORED_FILES_ROOM = 2;

  // Why: uploads live in memory, so the bytes held at once are capped, not only their count: room for two of the largest files.
  static readonly MAX_STORED_BYTES = MediaInputUtil.MAX_BYTES * MediaUploadService.STORED_FILES_ROOM;

  static readonly TOKEN_BYTES = 32;

  static readonly IMAGE_ID_BYTES = 16;

  private readonly clock: () => number;

  private readonly tokenToLink = new Map<string, PendingLink>();

  private readonly imageIdToStored = new Map<string, StoredImage>();

  constructor(options: MediaUploadServiceOptions) {
    this.clock = options.clock;
  }

  createLink(kind: MediaKind = "image"): MediaUploadLink {
    this.removeExpired();
    if (this.tokenToLink.size + this.imageIdToStored.size >= MediaUploadService.MAX_ENTRIES) {
      throw new MediaUploadError("too_many_links");
    }
    const token = randomBytes(MediaUploadService.TOKEN_BYTES).toString("base64url");
    const imageId = randomBytes(MediaUploadService.IMAGE_ID_BYTES).toString("base64url");
    const expiresAtMs = this.clock() + MediaUploadService.LINK_TTL_SECONDS * MediaUploadService.MS_PER_SECOND;
    this.tokenToLink.set(token, { imageId, kind, expiresAtMs });
    const maxBytes = MediaInputUtil.KIND_TO_MAX_BYTES[kind];
    return { token, imageId, kind, maxBytes, expiresInSeconds: MediaUploadService.LINK_TTL_SECONDS };
  }

  hasLink(token: string): boolean {
    this.removeExpired();
    return this.tokenToLink.has(token);
  }

  accept(token: string, bytes: Uint8Array): MediaUploadReceipt {
    this.removeExpired();
    const link = this.tokenToLink.get(token);
    if (link === undefined) {
      throw new MediaUploadError("unknown_link");
    }
    if (bytes.byteLength > MediaInputUtil.KIND_TO_MAX_BYTES[link.kind]) {
      throw new MediaUploadError("too_large", link.kind);
    }
    const found = MediaInputUtil.detect(bytes, link.kind);
    if (found === undefined) {
      throw new MediaUploadError("not_an_image", link.kind);
    }
    if (this.countStoredBytes() + bytes.byteLength > MediaUploadService.MAX_STORED_BYTES) {
      throw new MediaUploadError("too_many_links");
    }
    this.tokenToLink.delete(token);
    const expiresAtMs = this.clock() + MediaUploadService.IMAGE_TTL_SECONDS * MediaUploadService.MS_PER_SECOND;
    const media: UploadedMedia = { kind: link.kind, mime: found.mime, extension: found.extension, bytes };
    this.imageIdToStored.set(link.imageId, { media, expiresAtMs });
    return { imageId: link.imageId, kind: link.kind, mime: found.mime, sizeBytes: bytes.byteLength };
  }

  readImage(imageId: string): UploadedImage {
    const media = this.readMedia(imageId, "image");
    return { mime: media.mime as ImageMime, bytes: media.bytes };
  }

  readMedia(imageId: string, kind: MediaKind): UploadedMedia {
    this.removeExpired();
    const stored = this.imageIdToStored.get(imageId);
    if (stored === undefined) {
      throw new MediaUploadError("image_not_found");
    }
    if (stored.media.kind !== kind) {
      throw new MediaUploadError("wrong_kind", kind);
    }
    return stored.media;
  }

  private countStoredBytes(): number {
    let total = 0;
    for (const stored of this.imageIdToStored.values()) {
      total += stored.media.bytes.byteLength;
    }
    return total;
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
