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

  static readonly FIRST_OK_STATUS = 200;

  static readonly FIRST_REDIRECT_STATUS = 300;

  static readonly FIRST_ERROR_STATUS = 400;

  static readonly ACCEPT = "image/png,image/jpeg,image/webp";

  private readonly timeoutMs: number;

  private readonly isPublicAddress: (address: string) => boolean;

  private readonly ca: string | undefined;

  constructor(options: HttpsImageDownloadAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? HttpsImageDownloadAdapter.DEFAULT_TIMEOUT_MS;
    this.isPublicAddress = options.isPublicAddress ?? ((address: string) => PublicAddressUtil.isPublic(address));
    this.ca = options.ca;
  }

  async download(url: URL, signal?: AbortSignal): Promise<Uint8Array> {
    const host = url.hostname;
    if (isIP(host.replace(/^\[|\]$/g, "")) !== 0 && !this.isPublicAddress(host)) {
      throw new RemoteImageError("non_public_address");
    }
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
    try {
      return await this.requestBytes(url, combined);
    } catch (error: unknown) {
      throw HttpsImageDownloadAdapter.classify(error, signal, deadline);
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

  private requestBytes(url: URL, signal: AbortSignal): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const outgoing = request(url, {
        method: "GET",
        headers: { accept: HttpsImageDownloadAdapter.ACCEPT },
        lookup: this.buildGuardedLookup(),
        agent: false,
        ca: this.ca,
        signal,
      }, (response) => {
        HttpsImageDownloadAdapter.readBody(response).then(resolve, reject);
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

  static async readBody(response: IncomingMessage): Promise<Uint8Array> {
    const status = response.statusCode ?? 0;
    const isRedirect = status >= HttpsImageDownloadAdapter.FIRST_REDIRECT_STATUS
      && status < HttpsImageDownloadAdapter.FIRST_ERROR_STATUS;
    if (isRedirect) {
      response.destroy();
      throw new RemoteImageError("redirect");
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
