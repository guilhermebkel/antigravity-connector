export type CreateUploadLinkInput = { readonly noArguments?: never };

export type CreateUploadLinkOutput = {
  uploadPath: string;
  uploadUrl?: string;
  image: string;
  expiresInSeconds: number;
  maxBytes: number;
};

export type UploadTokenParams = { token: string };
