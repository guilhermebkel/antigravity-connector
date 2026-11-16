export type RemoteImageUrlReason = "invalid_url" | "not_https" | "has_credentials";

export type RemoteImageUrlValid = {
  isValid: true;
  url: URL;
};

export type RemoteImageUrlInvalid = {
  isValid: false;
  reason: RemoteImageUrlReason;
};

export type RemoteImageUrlResult = RemoteImageUrlValid | RemoteImageUrlInvalid;

export interface RemoteImageDownloadPort { download(url: URL, signal?: AbortSignal): Promise<Uint8Array> }
