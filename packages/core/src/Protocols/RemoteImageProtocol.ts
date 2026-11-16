export type RemoteImageUrlReason = "invalid_url" | "not_https";

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
