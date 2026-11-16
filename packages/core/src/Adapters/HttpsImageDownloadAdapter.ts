import { lookup as lookupAddress, type LookupAddress } from "node:dns";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { RemoteImageDownloadPort } from "@antigravity-connector/core/Protocols/RemoteImageProtocol.ts";
import { RemoteImageError } from "@antigravity-connector/core/Errors/RemoteImageError.ts";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";
import { PublicAddressUtil } from "@antigravity-connector/core/Utils/PublicAddressUtil.ts";

export type HttpsImageDownloadAdapterOptions = {
  timeoutMs?: number;
  isPublicAddress?: (address: string) => boolean;
  ca?: string;
};

export class HttpsImageDownloadAdapter implements RemoteImageDownloadPort {
  static readonly DEFAULT_TIMEOUT_MS = 15000;

  static readonly MAX_REDIRECTS = 3;

  static readonly FIRST_OK_STATUS = 200;

  static readonly FIRST_REDIRECT_STATUS = 300;

  static readonly FIRST_ERROR_STATUS = 400;

  static readonly ACCEPT = "image/png,image/jpeg,image/webp";

  static readonly USER_AGENT = "antigravity-connector";

  private readonly timeoutMs: number;

  private readonly isPublicAddress: (address: string) => boolean;

  private readonly ca: string | undefined;

  constructor(options: HttpsImageDownloadAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? HttpsImageDownloadAdapter.DEFAULT_TIMEOUT_MS;
    this.isPublicAddress = options.isPublicAddress ?? ((address: string) => PublicAddressUtil.isPublic(address));
    this.ca = options.ca;
  }

  async download(url: URL, signal?: AbortSignal): Promise<Uint8Array> {
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
    try {
      return await this.downloadThroughRedirects(url, combined);
    } catch (error: unknown) {
      throw HttpsImageDownloadAdapter.classify(error, signal, deadline);
    }
  }

  private async downloadThroughRedirects(first: URL, signal: AbortSignal): Promise<Uint8Array> {
    let current = first;
    for (let hop = 0; hop <= HttpsImageDownloadAdapter.MAX_REDIRECTS; hop += 1) {
      this.assertPublicHost(current);
      // Why: every hop is awaited in order, because the next address is only known from the answer of the last one.
      const outcome = await this.requestOnce(current, signal);
      if (!(outcome instanceof URL)) {
        return outcome;
      }
      current = outcome;
    }
    throw new RemoteImageError("redirect");
  }

  private assertPublicHost(url: URL): void {
    const host = url.hostname;
    if (isIP(host.replace(/^\[|\]$/g, "")) !== 0 && !this.isPublicAddress(host)) {
      throw new RemoteImageError("non_public_address");
    }
  }

  static classify(error: unknown, signal: AbortSignal | undefined, deadline: AbortSignal): unknown {
    if (error instanceof RemoteImageError) {
      return error;
    }
    if (signal?.aborted === true) {
      return error;
    }
    return new RemoteImageError(deadline.aborted ? "timeout" : "unreachable");
  }

  private requestOnce(url: URL, signal: AbortSignal): Promise<Uint8Array | URL> {
    return new Promise<Uint8Array | URL>((resolve, reject) => {
      const outgoing = request(url, {
        method: "GET",
        headers: { "accept": HttpsImageDownloadAdapter.ACCEPT, "user-agent": HttpsImageDownloadAdapter.USER_AGENT },
        lookup: this.buildGuardedLookup(),
        agent: false,
        ca: this.ca,
        signal,
      }, (response) => {
        HttpsImageDownloadAdapter.readResponse(response, url).then(resolve, reject);
      });
      outgoing.on("error", reject);
      outgoing.end();
    });
  }

  private buildGuardedLookup(): LookupFunction {
    return (hostname, options, callback) => {
      lookupAddress(hostname, { ...options, all: true }, (error, addresses) => {
        const list: LookupAddress[] = Array.isArray(addresses) ? addresses : [];
        if (error !== null) {
          callback(error, "", 0);
          return;
        }
        if (list.length === 0 || !list.every((entry) => this.isPublicAddress(entry.address))) {
          callback(new RemoteImageError("non_public_address"), "", 0);
          return;
        }
        HttpsImageDownloadAdapter.answerLookup(list, options.all === true, callback);
      });
    };
  }

  static answerLookup(list: readonly LookupAddress[], isAll: boolean, callback: Parameters<LookupFunction>[2]): void {
    const [first] = list;
    if (isAll) {
      callback(null, [...list]);
      return;
    }
    callback(null, first?.address ?? "", first?.family ?? 0);
  }

  static async readResponse(response: IncomingMessage, current: URL): Promise<Uint8Array | URL> {
    const status = response.statusCode ?? 0;
    const isRedirect = status >= HttpsImageDownloadAdapter.FIRST_REDIRECT_STATUS
      && status < HttpsImageDownloadAdapter.FIRST_ERROR_STATUS;
    if (isRedirect) {
      return HttpsImageDownloadAdapter.readRedirect(response, current);
    }
    const isOk = status >= HttpsImageDownloadAdapter.FIRST_OK_STATUS
      && status < HttpsImageDownloadAdapter.FIRST_REDIRECT_STATUS;
    if (!isOk) {
      response.destroy();
      throw new RemoteImageError("bad_status");
    }
    const declared = Number(response.headers["content-length"] ?? 0);
    if (declared > ImageInputUtil.MAX_IMAGE_BYTES) {
      response.destroy();
      throw new RemoteImageError("too_large");
    }
    return HttpsImageDownloadAdapter.collect(response);
  }

  static readRedirect(response: IncomingMessage, current: URL): URL {
    const location = response.headers.location ?? "";
    response.destroy();
    if (location === "" || !URL.canParse(location, current.href)) {
      throw new RemoteImageError("redirect");
    }
    const next = new URL(location, current);
    if (next.protocol !== "https:") {
      throw new RemoteImageError("redirect");
    }
    return next;
  }

  static async collect(response: IncomingMessage): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response) {
      const part = chunk as Buffer;
      total += part.byteLength;
      if (total > ImageInputUtil.MAX_IMAGE_BYTES) {
        response.destroy();
        throw new RemoteImageError("too_large");
      }
      chunks.push(part);
    }
    return new Uint8Array(Buffer.concat(chunks));
  }
}
