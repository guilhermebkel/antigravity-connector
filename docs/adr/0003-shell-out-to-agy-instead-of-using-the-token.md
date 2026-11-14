# 0003. Shell out to the agy binary instead of using the login token

Status: accepted (2026-11-14)

## Context

The project exposes a Google AI Pro subscription as an API and as MCP tools for personal use. The Antigravity CLI (`agy`) logs in with Google OAuth and keeps the token in a file under its own state folder. Two ways to serve a call exist: run the official binary, or take that token and call Google's internal API directly.

## Decision

Every call runs the official `agy` binary as a subprocess (`agy -p`, with a JSON or stream-JSON output format). The app never reads, copies, logs or forwards the OAuth token, never puts it in an environment variable and never calls Google directly. Only the `agy` package may spawn a process, and no source file may name the credentials folder; both are lint rules.

## Considered options

- **Direct use of the token (calling Google's internal API from our code): rejected.** Third-party tools that did this were disabled by Google with a `403 TOS_VIOLATION` ([forum report](https://discuss.ai.google.dev/t/request-for-manual-review-antigravity-access-disabled-403-tos-violation-third-party-integration-removed/198604)), and accounts were banned in February and November 2026. Clause 6 of the [Antigravity Additional Terms](https://antigravity.google/terms) treats access through third-party software as a breach.
- **Shell-out to the official binary: accepted.** Traffic keeps coming from the official client, which lowers the risk and does not remove it.

## Consequences

- The risk is lower, not zero. The single global queue, the daily limits and tool descriptions that state their cost exist because of it. Low, personal use is part of the design.
- Latency and tokens are those of the CLI: an image takes about a minute and a research report several minutes.
- Login happens inside the container through the CLI's own flow ([headless authentication](https://github.com/google-antigravity/antigravity-cli/issues/223), [OAuth in a container](https://github.com/google-antigravity/antigravity-cli/issues/10)); how the session persists is settled by the spike issue and recorded in ADR 0005 when it is written.
- The project brief (issue #1) keeps the tested facts about `agy` and the sources.
