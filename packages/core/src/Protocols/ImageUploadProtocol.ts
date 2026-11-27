import type { ImageMime } from "@antigravity-connector/core/Protocols/ImageInputProtocol.ts";
import type { MediaKind } from "@antigravity-connector/core/Protocols/MediaProtocol.ts";

export type ImageUploadLink = {
  token: string;
  imageId: string;
  kind: MediaKind;
  maxBytes: number;
  expiresInSeconds: number;
};

export type UploadedImage = {
  mime: ImageMime;
  bytes: Uint8Array;
};

export type UploadedMedia = {
  kind: MediaKind;
  mime: string;
  extension: string;
  bytes: Uint8Array;
};

export type ImageUploadReceipt = {
  imageId: string;
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
};
