# 0014. Reference images by https URL

Status: accepted (2026-11-16). Changes one decision in [0004](0004-scope-chat-image-search-research-and-browsing.md): the server now fetches a URL for `generate_image`, and only for it.

## Context

`generate_image` took reference images only as base64 `data:` URLs, and a remote URL was refused. An MCP client has to put the whole picture in the call: a 512 px JPEG is about 15,000 characters and a real photo can reach 5.6 million. A model that copies that text by hand truncates it, so editing a photo did not work in practice (issue #51).

The server runs on the owner's VPS, and the address in `images` is chosen by the client. Fetching it is a server-side request forgery risk: the address could point at the VPS itself, at the cloud metadata service (`169.254.169.254`) or at another host on the private network.

## Decision

- An entry of `images` is a base64 `data:` URL or an `https://` URL. The chat API is not changed: it takes `data:` URLs only.
- The download runs before the call enters the queue, in `core`, and it is held to these limits in code:
  - Only `https:`, with no user name or password in the address. The schema refuses anything else before a run starts.
  - The socket connects only to an address that is on the public internet. The check runs in the lookup that the socket itself uses, so a DNS answer that changes between the check and the connection cannot get past it; an address written in the URL is checked before any lookup. A host with one public and one private address is refused.
  - A redirect is not followed, and a status outside 2xx is an error.
  - The body stops at 4 MiB, with or without `Content-Length`, and the whole request, body included, stops after 15 seconds.
  - The type comes from the first bytes (PNG, JPEG or WebP), never from the `Content-Type` header or from the end of the address.
- The request carries only an `Accept` header: no cookie, no authorization and nothing of the server.
- An error names which reference image failed, why and what to do next. It never contains the address, the query string or the bytes, and nothing about the address is logged.

## Consequences

- A client can send `https://host/photo.jpg` and spend a few tokens instead of the picture.
- A picture that sits behind a login, a redirect or a private network cannot be used by URL; the client sends it as a `data:` URL, as before.
- The server makes outbound HTTPS requests to addresses the client picks. The address guard is a rule that cannot fail, so it is code with tests, including a local listener that must receive no connection.
- Reading an image from a file path or an upload endpoint stays out of scope. It would need the client and the server to share a disk or a new route.
