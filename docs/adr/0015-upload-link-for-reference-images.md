# 0015. An upload link for reference images

Status: accepted (2026-11-16). Extends [0014](0014-reference-images-by-https-url.md): a reference image can also arrive through a one-time upload link. The bearer key still guards every route but `/health` and the upload links.

## Context

[0014](0014-reference-images-by-https-url.md) lets `generate_image` take an `https://` URL, but a photo on the owner's own machine has no public URL. The other way, a base64 `data:` URL, puts the whole picture in the tool call: a model that copies thousands of characters by hand corrupts them, and `agy` then fails without saying why. A client that can run a command can send the file; the model cannot carry its bytes.

## Decision

- The MCP tool `create_upload_link` takes no argument. It returns `uploadPath` (`/upload/<token>`), `image` (`upload:<id>`), `expiresInSeconds` and `maxBytes`. It starts no `agy` run and spends no quota.
- `POST /upload/<token>` takes the file as the raw request body, whatever the `Content-Type`. The answer is JSON with `image`, `mimeType` and `sizeBytes`. The path takes no bearer: the token is the credential, 32 random bytes, and each link works once.
- The server sits behind a proxy and does not know its own address. The optional `PUBLIC_URL` (an origin, no path) makes the tool return the full `uploadUrl`; without it the tool returns `uploadPath` only and the client joins it to the host it already uses for MCP.
- The type comes from the first bytes (PNG, JPEG or WebP) and the size stops at 4 MiB, the same limits as a URL. A file that is not a picture, or that is too large, is refused and the link stays valid, so the right file can follow.
- An unknown or expired token is refused before the body is read, so nobody without a link makes the server buffer 4 MiB. Upload requests have their own rate bucket (`HTTP_MAX_REQUESTS_PER_MINUTE`), so they never use the budget of calls that carry the key, and an attack on the path can stop uploads for a minute but nothing else.
- `generate_image` accepts `upload:<id>` in `images`, next to `data:` and `https://` values. The id is not the token, so the path that uploads cannot be used to read a picture back.
- The server holds the picture in memory only: a link lives 5 minutes, a picture 15 minutes after the upload, and at most 8 links and pictures exist at once (32 MiB at most). A restart forgets them. Several calls can use one picture, so a follow-up edit needs no new upload.
- Nothing about a token, an id or the bytes is logged, and an error never repeats the token.

## Consequences

- A model that cannot paste a long base64 can still edit a local photo: it asks for a link, the client sends the file with `curl --data-binary`, and the call carries 30 characters.
- The client needs the public address of the server and a way to send an HTTP request. A chat that can reach the server only through MCP, with no shell, still needs a URL or a `data:` URL.
- One path is open to the internet without the key. Its guard is code with tests: single use, expiry, the early refusal, the size and type limits and the separate rate bucket each have a test that fails when the rule is removed.
- The pictures wait in memory instead of on disk, so there is no cleanup job and no file path a client could name.
