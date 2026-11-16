import type { ImageMime } from "@antigravity-connector/core/Protocols/ImageInputProtocol.ts";

export type ImageUploadLink = {
  token: string;
  imageId: string;
  expiresInSeconds: number;
};

export type UploadedImage = {
  mime: ImageMime;
  bytes: Uint8Array;
};

export type ImageUploadReceipt = {
  imageId: string;
  mime: ImageMime;
  sizeBytes: number;
};
