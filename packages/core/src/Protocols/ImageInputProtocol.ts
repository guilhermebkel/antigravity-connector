export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export type ImageInputReason = "not_data_url" | "too_large" | "signature_mismatch";

export type ImageInputValid = {
  isValid: true;
  mime: ImageMime;
  bytes: Uint8Array;
};

export type ImageInputInvalid = {
  isValid: false;
  reason: ImageInputReason;
  mime?: ImageMime;
};

export type ImageInputResult = ImageInputValid | ImageInputInvalid;
