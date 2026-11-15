# 0012. Login through the HTTP API and MCP, with the code sent to agy

Status: accepted (2026-11-14). Supersedes [0009](0009-no-web-page-login-through-docker-exec.md).

## Context

The owner runs the server on a VPS, often through a platform that has no shell into the container, so `docker exec` is not available. `agy` needs a Google login once. Its login flow prints a link, waits for the authorization code, and writes its own login state into its HOME.

Checked with the real `agy`: it prints the link and reads the pasted code only on a terminal. Under a pseudo-terminal (util-linux `script`) the code sent on stdin is accepted, and a wrong code ends the attempt with an error. A login attempt waits 60 seconds.

## Decision

- `GET /v1/auth` (API) and the `check_auth` tool (MCP) report the login state. When agy is not logged in they start a login attempt and return `login_url` and `expires_in_seconds` (60).
- `POST /v1/auth` with `{"code": "..."}` (API) and the `set_auth` tool (MCP) send the code to that attempt. The result is `connected`, or an error when the code was refused or no attempt is open; the client then asks for a new link.
- The attempt is one agy process, started under `script`, that stays alive between the two calls. The link is bound to that process, so it is only valid for the attempt that issued it.
- The app forwards the authorization code once, to agy's stdin. It does not store, log or echo the code. agy exchanges the code and writes its own login state; the app still never reads, copies or forwards the login token.
- Both routes need the API key, like every route except `/health`.

## Consequences

- No `docker exec` is needed: the owner logs in with two requests, from any client that has the API key.
- The code travels over HTTPS through the owner's proxy, and the link lasts 60 seconds.
- The image needs `script` (util-linux), which the Dockerfile installs.
- The success path is verified in tests with a fake agy only; the real success needs a real code from the owner's login.
