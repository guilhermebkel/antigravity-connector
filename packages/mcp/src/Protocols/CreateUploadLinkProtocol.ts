export type CreateUploadLinkInput = { kind?: "image" | "audio" | "video" };

export type CreateUploadLinkOutput = {
  uploadPath: string;
  uploadUrl?: string;
  kind: "image" | "audio" | "video";
  file: string;
  image: string;
  expiresInSeconds: number;
  maxBytes: number;
};

export type UploadTokenParams = { token: string };
