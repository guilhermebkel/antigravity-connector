import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export type RemoteImageReason
  = | "invalid_url"
    | "not_https"
    | "has_credentials"
    | "non_public_address"
    | "redirect"
    | "bad_status"
    | "too_large"
    | "not_an_image"
    | "timeout"
    | "unreachable";

export class RemoteImageError extends Error {
  static readonly REASON_TO_TEXT: Readonly<Record<RemoteImageReason, string>> = {
    invalid_url: "is not a valid URL of at most 2048 characters. What to do: send a base64 data: URL or a plain https:// URL.",
    not_https: "does not start with https://. What to do: send an https:// URL, or a base64 data: URL.",
    has_credentials: "has a user name or password in its address. What to do: send a URL without credentials.",
    non_public_address: "points to an address that is not on the public internet. What to do: send a URL on a public host, or a base64 data: URL.",
    redirect: "answers with a redirect, and redirects are not followed. What to do: send the final URL of the image.",
    bad_status: "answered with an error status. What to do: check that the URL is public, or send a base64 data: URL.",
    too_large: "is larger than 4 MiB. What to do: send a smaller picture.",
    not_an_image: "is not a PNG, JPEG or WebP picture. What to do: send a link that serves one of those files.",
    timeout: "did not answer in time. What to do: retry, or send a base64 data: URL.",
    unreachable: "could not be reached. What to do: check that the host is public and online, or send a base64 data: URL.",
  };

  readonly code: OpenAiErrorCode = "invalid_request_error";

  readonly reason: RemoteImageReason;

  constructor(reason: RemoteImageReason, imageNumber?: number) {
    const label = imageNumber === undefined ? "A reference image" : `Reference image ${imageNumber}`;
    super(`${label} ${RemoteImageError.REASON_TO_TEXT[reason]}`);
    this.name = "RemoteImageError";
    this.reason = reason;
  }
}
