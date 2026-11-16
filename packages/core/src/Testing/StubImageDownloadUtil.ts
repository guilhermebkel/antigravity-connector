import type { RemoteImageDownloadPort } from "@antigravity-connector/core/Protocols/RemoteImageProtocol.ts";

export type StubImageResponder = (url: URL) => Promise<Uint8Array>;

export class StubImageDownloadUtil implements RemoteImageDownloadPort {
  readonly urls: string[] = [];

  private readonly respond: StubImageResponder;

  constructor(respond: StubImageResponder) {
    this.respond = respond;
  }

  download(url: URL): Promise<Uint8Array> {
    this.urls.push(url.href);
    return this.respond(url);
  }
}
