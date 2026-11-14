# 0011. Run on a VPS behind HTTPS, not only on localhost

Status: accepted (2026-11-14). Supersedes the localhost-only rule of the MVP brief (issue #1) and the README and site wording built on it.

## Context

The owner wants to use the subscription from the local Claude Code on other machines, such as generating images from the MCP tool, without keeping a computer on at home. A local-only bind cannot serve that: the server has to be reachable from the owner's machines over the internet.

## Decision

- The server runs on a VPS the owner controls. It is reached through HTTPS on a host name the owner owns.
- A Caddy container terminates TLS for `DOMAIN` (automatic certificates) and forwards to the app inside the compose network. Only Caddy publishes ports (80 and 443). The app's port 8787 is not published.
- The `API_KEY` stays the only access control: every route but `/health` needs it. The daily limits, the queue and the redaction rules stay in code, as before.
- The bind guard stays. The image sets `ALLOW_NON_LOOPBACK_BIND=true` only because the app must listen on all interfaces for the proxy to reach it; running the binary outside Docker still listens on loopback by default.
- The login (agy) is still done once on the VPS with `docker exec`, and the login volume stays on the VPS.

## Consequences

- The server is reachable from the internet. Anyone who has the API key can spend the owner's daily limits, so the key must be long and random, and it can be rotated in `.env`.
- The VPS firewall must allow 80 and 443 and nothing else. Caddy needs a host name that points to the VPS and reachable ports 80 and 443 for the certificate challenge.
- The "localhost-only" promise is gone from the README, the site, AGENTS.md and the glossary. The rest of the rules (no token reading, redaction, one queue, daily limits) are unchanged.
