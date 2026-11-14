<h1 align="center">antigravity-connector</h1>

<p align="center">
  <strong>Use your Google AI Pro subscription as an OpenAI-compatible API and as MCP tools, from one Docker container on your own machine.</strong>
  <br />
  <em>A personal, localhost-only server. Every call runs the official Antigravity CLI (<code>agy</code>); the app never touches your login token. Not affiliated with Google.</em>
</p>

<p align="center">
  <a href="#status"><img src="https://img.shields.io/badge/Status-under_construction-f4e40c" alt="Status: under construction" /></a>
  <a href="https://github.com/guilhermebkel/antigravity-connector/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/guilhermebkel/antigravity-connector/ci.yml?branch=master&label=CI" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Telemetry-none-2ea44f" alt="No telemetry" />
</p>

---

**A subscription is not an API key, and taking its token is the fast way to lose the account.** Third-party tools that reused the Antigravity login token were cut off with a `403 TOS_VIOLATION`, and accounts were banned.

`antigravity-connector` does the one thing that keeps traffic coming from the official client: it runs the `agy` binary as a subprocess for every call. The server never reads, copies, logs or forwards the token, and never calls Google directly. The rules that keep it that way are lint rules and tests, not comments ([ADR 0003](docs/adr/0003-shell-out-to-agy-instead-of-using-the-token.md)).

> **The risk is lower, not zero.** Google's terms treat access through third-party software as a breach. This server is built for low, personal use: one user, one machine, one call at a time.

---

## Status

This repository is built issue by issue. The execution order is in the roadmap issue [#29](https://github.com/guilhermebkel/antigravity-connector/issues/29) and the project brief is [#1](https://github.com/guilhermebkel/antigravity-connector/issues/1). **There is nothing to run yet.** The monorepo, the harness, the lint rules and the docs are in place; the server, the doors and the Docker image come next. The sections below describe what the finished server does, with the names already fixed.

## What you get

<table>
<tr>
<td width="50%" valign="top">

**Two doors, one process**

An OpenAI-compatible API under `/v1` (chat with and without streaming, models, later images) and an MCP server under `/mcp` over Streamable HTTP. Works from the Vercel AI SDK, scripts, Claude Code and any MCP client.

</td>
<td width="50%" valign="top">

**One call at a time**

Both doors share one global queue with concurrency 1, plus a daily limit per kind of run. That is the cost control for a subscription, and the reason MCP over stdio is out of scope ([ADR 0006](docs/adr/0006-api-and-mcp-in-one-process-with-one-queue.md)).

</td>
</tr>
<tr>
<td valign="top">

**Local by default**

Listens on `127.0.0.1` and refuses to start on any other address unless you allow it. Every route but `/health` needs the bearer `API_KEY`.

</td>
<td valign="top">

**No web page, no database**

The login link appears in the container logs and the code goes in through `docker exec` ([ADR 0009](docs/adr/0009-no-web-page-login-through-docker-exec.md)). State lives in memory ([ADR 0008](docs/adr/0008-no-database-in-the-mvp.md)).

</td>
</tr>
</table>

## What it can do

| Capability | Door | How it runs |
| --- | --- | --- |
| Chat | `/v1/chat/completions`, with and without streaming | `agy -p`, plan mode, no file edits |
| Web search | MCP tool `web_search` | `agy` with its search tool, answer with source URLs |
| Image generation | MCP tool `generate_image`, later `/v1/images/generations` | The native image subagent, in a fresh temporary directory |
| Research | MCP tool `research` (later) | A longer report with links; takes minutes |
| Browsing | MCP tool `browse` (later) | The `/browser` command with a throwaway browser profile |

Video, Google Flow, Deep Research from the Gemini app, workflows, swarms, MCP over stdio, any web page, several users and exposing the server to a network are out of scope ([ADR 0004](docs/adr/0004-scope-chat-image-search-research-and-browsing.md)).

## Quick start

Planned, and available when the Docker image lands ([#19](https://github.com/guilhermebkel/antigravity-connector/issues/19)):

```bash
docker compose up -d
docker compose logs -f          # prints the Google login link on the first start
docker exec -it antigravity-connector agy   # paste the authorization code
curl http://127.0.0.1:8787/health
```

Then point a client at it:

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.8-flash-medium","messages":[{"role":"user","content":"ping"}]}'
```

```json
{
  "mcpServers": {
    "antigravity": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": { "Authorization": "Bearer your-long-random-secret" }
    }
  }
}
```

## Configuration

The names are fixed in the brief so every issue agrees; `core` and the server read them in one place.

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_KEY` | none, required | Bearer secret for `/v1` and `/mcp`. Startup fails when it is missing or shorter than 24 characters |
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `8787` | Bind port |
| `ALLOW_NON_LOOPBACK_BIND` | `false` | Must be `true` to bind a non-loopback `HOST`. Only the Docker image sets it |
| `AGY_BIN` | `agy` | Path of the binary. Tests and `pnpm dev` point it at the fake |
| `AGY_TIMEOUT_MS` | `300000` | Kill an `agy` run after this long |
| `QUEUE_MAX_WAIT_MS` | `120000` | A call that waits longer in the queue fails with a clear error |
| `DAILY_LIMIT_CHAT`, `_SEARCH`, `_IMAGE`, `_RESEARCH`, `_BROWSE` | `200`, `50`, `20`, `5`, `20` | Calls allowed per kind per UTC day |
| `HTTP_MAX_REQUESTS_PER_MINUTE` | `120` | Rate limit, one bucket for failed authentication and one for authenticated requests |
| `MCP_MAX_SESSIONS`, `MCP_SESSION_TTL_MS` | `8`, `1800000` | MCP session cap and idle expiry |

## How it works

```text
  client ──▶ 1. AUTH ──▶ 2. VALIDATE ──▶ 3. LIMIT + QUEUE ──▶ 4. RUN agy ──▶ 5. REPLY
  (/v1, /mcp)  bearer key   strict Zod      daily limit, then    fresh empty    OpenAI shape
               SHA-256      schemas         the one global       temp dir,      or MCP result,
                                            queue                timeout        logs: metadata only
```

The work is split into packages on purpose, and the direction of the imports is a lint rule:

| Package | Does | Why |
| --- | --- | --- |
| `apps/server` | Fastify; mounts the API, the MCP endpoint and `/health` | It only mounts; no rule lives here |
| `packages/api` | The OpenAI-compatible routes | Nothing outside the OpenAI format; never imports `agy` |
| `packages/mcp` | The tool manifest, input and output schemas | Never imports `agy` or `api` |
| `packages/core` | The queue, the daily limits, the session state, the environment, the logging | One place enforces the limits for both doors |
| `packages/agy` | The only place that spawns the binary, and the fake `agy` for tests | The only package that may import `child_process` |
| `packages/protocol` | Shared types and Zod schemas | Imports no other package |

Decisions are in [`docs/adr/`](docs/adr/), vocabulary in [`GLOSSARY.md`](GLOSSARY.md).

## Privacy and safety

- **The login token stays with `agy`.** No source file names its credentials folder (lint rule), and the app never reads, copies, logs or forwards it.
- **Logs carry metadata only:** door, route or tool, model, duration and token counts. Never a message, a search query, a prompt, image bytes or the `API_KEY`. Every output path is tested with a fake secret.
- **Every run is boxed:** a fresh empty temporary directory, a timeout that kills the process, and plan mode for chat, search and research. Browsing always uses a throwaway profile.
- **The only network exit is the `agy` binary.** No telemetry, no analytics.

Found a way around any of this? Open an issue without secrets in it.

## How it compares

- **Using the token directly (a proxy that calls Google's internal API)** is what got accounts banned. Here the token never leaves the CLI.
- **A generic OpenAI proxy** gives every client the whole subscription with no queue and no limits. Here there is one queue, a daily limit per kind of run and a loopback-only bind.

## FAQ

<details>
<summary><b>Can I expose it to the internet or share it with other people?</b></summary>

No. It is a single-user, localhost-only server, and the subscription is yours. Binding another address needs `ALLOW_NON_LOOPBACK_BIND=true`, which only the Docker image sets, and the compose file publishes the port on `127.0.0.1` only.

</details>

<details>
<summary><b>Why is the first login done in a terminal?</b></summary>

There is no web page on purpose. When there is no session, `agy` prints a login link; you open it, sign in and paste the code with `docker exec`. `/health` says whether the session is connected, as seen by a real `agy` check, never by configuration ([ADR 0009](docs/adr/0009-no-web-page-login-through-docker-exec.md)).

</details>

<details>
<summary><b>Does the login survive a container restart?</b></summary>

That is what the spike ([#2](https://github.com/guilhermebkel/antigravity-connector/issues/2)) decides, and the answer is recorded in an ADR when it is done.

</details>

## Roadmap

The full order, in groups, is in [#29](https://github.com/guilhermebkel/antigravity-connector/issues/29).

- [x] **Harness and structure:** monorepo, lint rules, architecture tests, CI and docs ([#3](https://github.com/guilhermebkel/antigravity-connector/issues/3), [#4](https://github.com/guilhermebkel/antigravity-connector/issues/4), [#5](https://github.com/guilhermebkel/antigravity-connector/issues/5)).
- [ ] **Spike:** `agy` inside Docker, login and session persistence ([#2](https://github.com/guilhermebkel/antigravity-connector/issues/2)).
- [ ] **Chat over `/v1`**, then streaming.
- [ ] **MCP** with `web_search`, then images, research and browsing.
- [ ] **Docker image, end-to-end tests and the real acceptance run.**

## Contributing

Issues and pull requests are welcome. Start with [`AGENTS.md`](AGENTS.md), which says what to read for each kind of task.

### Development

Needs the Node version in `.nvmrc` and pnpm.

```bash
nvm use
pnpm install
pnpm check   # typecheck, lint, dead code, duplication, tests and build
```

A release is started by hand: run the `Release` workflow on `master` and pick `patch`, `minor` or `major` (`none` releases the current version). It checks everything, tags the commit, publishes the GitHub Release and, once the Dockerfile exists, the image to `ghcr.io/guilhermebkel/antigravity-connector`.

---

<p align="center">
  <strong>Your subscription. Your machine. One call at a time.</strong>
</p>

<p align="center">
  MIT License &copy; Guilherme Mota
</p>
