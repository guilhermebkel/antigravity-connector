import type { RunAttachment } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { RemoteImageDownloadPort } from "@antigravity-connector/core/Protocols/RemoteImageProtocol.ts";
import { RemoteImageError } from "@antigravity-connector/core/Errors/RemoteImageError.ts";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";
import { RemoteImageUrlUtil } from "@antigravity-connector/core/Utils/RemoteImageUrlUtil.ts";

export type ImageSourceServiceOptions = { downloader: RemoteImageDownloadPort };

export class ImageSourceService {
  static readonly DATA_URL_PREFIX = "data:";

  private readonly downloader: RemoteImageDownloadPort;

  constructor(options: ImageSourceServiceOptions) {
    this.downloader = options.downloader;
  }

  async readAttachments(urls: readonly string[], signal?: AbortSignal): Promise<RunAttachment[]> {
    return Promise.all(urls.map((url, index) => this.readAttachment(url, index, signal)));
  }

  private async readAttachment(url: string, index: number, signal: AbortSignal | undefined): Promise<RunAttachment> {
    if (url.startsWith(ImageSourceService.DATA_URL_PREFIX)) {
      return ImageInputUtil.readAttachment(url, index);
    }
    const imageNumber = index + 1;
    const parsed = RemoteImageUrlUtil.parse(url);
    if (!parsed.isValid) {
      throw new RemoteImageError(parsed.reason, imageNumber);
    }
    const bytes = await this.download(parsed.url, imageNumber, signal);
    const mime = ImageInputUtil.detectMime(bytes);
    if (mime === undefined) {
      throw new RemoteImageError("not_an_image", imageNumber);
    }
    return ImageInputUtil.buildAttachment(mime, bytes, index);
  }

  private async download(url: URL, imageNumber: number, signal: AbortSignal | undefined): Promise<Uint8Array> {
    try {
      return await this.downloader.download(url, signal);
    } catch (error: unknown) {
      if (error instanceof RemoteImageError) {
        throw new RemoteImageError(error.reason, imageNumber);
      }
      throw error;
    }
  }
}
