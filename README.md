<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/svg/horizontal-dark.svg" />
    <img src="design/svg/horizontal-light.svg" alt="antigravity-connector" width="420" />
  </picture>
</h1>

<p align="center">
  <strong>Use your Google AI Pro subscription as an OpenAI-compatible API and as MCP tools, from one Docker container on your own VPS, reached over HTTPS.</strong>
  <br />
  <em>A personal server on a VPS, behind HTTPS. Every call runs the official Antigravity CLI (<code>agy</code>); the app never touches your login token. Not affiliated with Google.</em>
</p>

<p align="center">
  <a href="#status"><img src="https://img.shields.io/badge/Status-working-2ea44f" alt="Status: working" /></a>
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

The server is built: the OpenAI-compatible API, the MCP endpoint with `web_search`, `generate_image`, `research` and `browse`, the Docker image, the end-to-end tests and the call log. What is still missing is in [Limits](#limits-and-what-is-not-supported-yet). The execution order is in [#29](https://github.com/guilhermebkel/antigravity-connector/issues/29) and the project brief is [#1](https://github.com/guilhermebkel/antigravity-connector/issues/1).

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

Listens on `127.0.0.1` by default and refuses to start on any other address unless you allow it. The image listens on all interfaces inside the compose network, and only Caddy is reachable from outside. Every route but `/health` needs the bearer `API_KEY`.

</td>
<td valign="top">

**No web page, almost no state**

The login link appears in the container logs and the code goes in through `docker exec` ([ADR 0009](docs/adr/0009-no-web-page-login-through-docker-exec.md)). The only stored data is a small SQLite call log with metadata, so the daily limits survive a restart ([ADR 0010](docs/adr/0010-sqlite-call-log-and-daily-counters.md)).

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

## Risk note

Running a subscription through a server you expose to the internet is not something Google documents for the CLI. Its terms, its limits and the CLI itself can change at any time, and a call can fail or be refused. Use it for yourself, on your own machine, at a low volume. Keep the API key secret: anyone who has it can spend your daily limits.

## Requirements

- Docker with Compose.
- A Google account with an AI Pro subscription.

## Quick start

```bash
cp .env.example .env                 # then set API_KEY to a random value of at least 24 characters
docker compose up -d --build
docker logs antigravity-connector    # shows the login block if agy is not logged in yet
docker exec antigravity-connector curl -s http://127.0.0.1:8787/health
```

## Install on a VPS with Docker

Docker commands only, no clone and no files: the image is `ghcr.io/guilhermebkel/antigravity-connector`, public on GitHub Container Registry. A Caddy container in front gets the HTTPS certificate for your domain. Only ports 80 and 443 are published.

Before you start, point a host name at the VPS (an A record, such as `connector.your-domain.com`) and open ports 80 and 443 in its firewall.

```bash
docker network create connector

docker run -d --name antigravity-connector --network connector --restart unless-stopped \
  -e API_KEY='your-random-api-key-at-least-24-chars' \
  -v agy-gemini:/home/agy/.gemini -v agy-data:/data \
  ghcr.io/guilhermebkel/antigravity-connector:latest

docker run -d --name antigravity-connector-caddy --network connector --restart unless-stopped \
  -p 80:80 -p 443:443 -e DOMAIN=connector.your-domain.com \
  -v caddy-data:/data -v caddy-config:/config \
  caddy:2 sh -c 'printf "%s {\n  reverse_proxy antigravity-connector:8787\n}\n" "$DOMAIN" > /etc/caddy/Caddyfile && exec caddy run --config /etc/caddy/Caddyfile'
```

Log in once, with the Google account that has the AI Pro plan (see [Logging in](#logging-in)):

```bash
docker logs antigravity-connector                 # shows the login block the first time
docker exec -it antigravity-connector agy
```

Check the HTTPS endpoint. It answers `{"status":"ok","agy":"connected"}` once Caddy has the certificate:

```bash
curl https://connector.your-domain.com/health
```

Then connect Claude Code on your computer:

```bash
claude mcp add --transport http antigravity https://connector.your-domain.com/mcp \
  --header "Authorization: Bearer your-random-api-key-at-least-24-chars"
```

The API key must be at least 24 characters, and it is the only access control: anyone who has it can spend your daily limits. Note that `docker inspect` shows the value of `-e API_KEY`, so keep the VPS to yourself.

To update, pull the new image and run the two commands again with the same names and volumes; the login and the call log stay in their volumes.

## Logging in

The first start has no session, so the server logs a login block with a URL and a command:

1. Read the link: `docker logs antigravity-connector`.
2. Open the URL in a browser, sign in, and copy the code it shows.
3. Run `docker exec -it antigravity-connector agy` and paste the code.
4. Check: `docker exec antigravity-connector curl -s http://127.0.0.1:8787/health` returns `{"status":"ok","agy":"connected"}`, and `https://connector.your-domain.com/health` answers the same through Caddy.

The login is kept in the named volume `agy-gemini`. `docker compose down` keeps it; `docker compose down -v` removes it, and you must log in again.

## Using the API

With `curl`:

```bash
curl https://connector.your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.8-flash","reasoning_effort":"low","messages":[{"role":"user","content":"Say hello in one word."}]}'
```

With the Vercel AI SDK (`@ai-sdk/openai-compatible`):

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const provider = createOpenAICompatible({
  name: "antigravity",
  baseURL: "https://connector.your-domain.com/v1",
  apiKey: process.env.API_KEY,
});
const { text } = await generateText({ model: provider("gemini-3.8-flash"), prompt: "Say hello in one word." });
```

More endpoints and options:

- `POST /v1/images/generations` returns one PNG as `data[0].b64_json`. `n` other than 1 and `response_format` other than `b64_json` return 400.
- `response_format` with `{"type":"json_schema","json_schema":{"name":"x","schema":{...}}}` returns the JSON as the message content. `json_object` returns any JSON object. A streamed structured answer is sent once, at the end.
- An `image_url` part with a base64 `data:` URL (PNG, JPEG or WebP, up to 4 MiB each, four per request) is saved for the run. Remote URLs are refused, and nothing is fetched.
- `conversation_id` from a previous response continues that conversation: send the new message only. The id is kept for 24 hours, in memory; after a restart, or once it expires, send the full history without it.

## Connecting Claude Code to `/mcp`

```bash
claude mcp add --transport http antigravity https://connector.your-domain.com/mcp \
  --header "Authorization: Bearer <API_KEY>"
```

The `web_search` tool returns a short answer with links. A search takes about 20 to 45 seconds and counts against `DAILY_LIMIT_SEARCH`.

The `generate_image` tool returns one PNG image. A call takes about a minute and counts against `DAILY_LIMIT_IMAGE`.

The `research` tool writes a Markdown report with a source link for each claim. A call takes several minutes (up to 10), spends tens of thousands of tokens, and counts against `DAILY_LIMIT_RESEARCH`. The report is capped at 20000 characters, and `truncated` says when it was cut.

The `browse` tool opens a public page in headless Chrome, reads it or does a simple task, and can return a screenshot. It has no logins and no saved cookies. Loopback and private addresses, and URLs with a user name or password, are refused. A call counts against `DAILY_LIMIT_BROWSE`. Pages may contain instructions; the tool treats them as data.

When the client sends a progress token, the server reports progress while a call waits in the queue and runs. A client that cancels a call stops the agy process.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `API_KEY` | none (required, at least 24 characters) | The bearer token every route except `/health` requires. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the image) | The address the server listens on. |
| `ALLOW_NON_LOOPBACK_BIND` | `false` (`true` in the image) | Allows a non-loopback `HOST`. The image sets it so the Caddy proxy in compose can reach the app; only Caddy publishes ports. |
| `DOMAIN` (the Caddy container) | none (required on the VPS) | The host name Caddy gets an HTTPS certificate for. It must point to the VPS. |
| `PORT` | `8787` | The port. |
| `AGY_BIN` | `agy` | The agy binary. |
| `AGY_TIMEOUT_MS` | `300000` | A call that runs longer is stopped. |
| `QUEUE_MAX_WAIT_MS` | `120000` | A call that waits longer in the queue is refused. |
| `DAILY_LIMIT_CHAT` / `_SEARCH` / `_IMAGE` / `_RESEARCH` / `_BROWSE` | `200` / `50` / `20` / `5` / `20` | Calls per UTC day, per kind. `0` refuses that kind. |
| `HTTP_MAX_REQUESTS_PER_MINUTE` | `120` | Requests per minute, counted separately for failed and valid authentications. |
| `DATA_DIR` | `data` (`/data` in the image) | Where the SQLite call log (`calls.sqlite`) is kept. It holds metadata only: no prompts, responses, queries, URLs or images. Rows older than 90 days are deleted at startup. |
| `MCP_MAX_SESSIONS` | `8` | MCP sessions open at once. |
| `MCP_SESSION_TTL_MS` | `1800000` | An MCP session idle for longer expires. |

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

## Limits and what is not supported yet

- One agy call runs at a time. Calls from the API and from MCP share one queue.
- Calls are slow: a chat answer takes seconds, a search takes tens of seconds.
- Streaming works with `stream: true` (Server-Sent Events, OpenAI chunk format). Set `stream_options.include_usage` to get the usage in the last chunk.
- Not available yet: tool calling (`tools` returns 400, because agy runs its own tools), PDF and other file input, audio and video, and a browser profile with your own logins.
- `browse` runs Chrome through agy's `/browser` command. The temporary directory of each run is removed after it; agy chooses where its Chrome profile lives, and no flag sets that, so the profile is not confined to the run directory yet.
- Sampling parameters (`temperature`, `top_p`, `max_tokens`, `max_completion_tokens`) are accepted and ignored. The response header `x-antigravity-connector-ignored-params` lists the ones you sent.
- The agy binary is pinned to version 1.5.9 in the image. It cannot update itself, because it is installed read-only for the server user.

## Troubleshooting

- **`/health` says `login_required` after a restart.** The login is gone: the volume was removed or the image was rebuilt without it. Log in again (see above). A restart or a recreate with the same volume keeps the login.
- **`503` with `queue_timeout`.** Another call held the queue longer than `QUEUE_MAX_WAIT_MS`. Retry in a moment.
- **`429` with `daily_limit_reached`.** The limit for that kind is used up. It resets at the next UTC midnight, and the message says when.
- **`504` with `agy_timeout`.** The call ran longer than `AGY_TIMEOUT_MS` and was stopped. Ask a shorter question.
- **`502` with `agy_failed`.** agy failed. The container logs show the cause without the prompt or the answer.
- **The container stops at once with a message about `API_KEY`.** `.env` is missing the key, or the key is shorter than 24 characters.

## Privacy and safety

- **The login token stays with `agy`.** No source file names its credentials folder (lint rule), and the app never reads, copies, logs or forwards it.
- **Logs carry metadata only:** door, route or tool, model, duration and token counts. Never a message, a search query, a prompt, image bytes or the `API_KEY`. Every output path is tested with a fake secret.
- **Every run is boxed:** a fresh empty temporary directory, a timeout that kills the process, and plan mode for chat, search and research. Browsing always uses a throwaway profile.
- **The only network exit is the `agy` binary.** No telemetry, no analytics.

Found a way around any of this? Open an issue without secrets in it.

## How it compares

- **Using the token directly (a proxy that calls Google's internal API)** is what got accounts banned. Here the token never leaves the CLI.
- **A generic OpenAI proxy** gives every client the whole subscription with no queue and no limits. Here there is one queue, a daily limit per kind of run, an API key and HTTPS in front.

## FAQ

<details>
<summary><b>Can I expose it to the internet or share it with other people?</b></summary>

No. It is a single-user server, reachable over HTTPS with an API key, and the subscription is yours. The bind guard refuses another address unless `ALLOW_NON_LOOPBACK_BIND=true`, which only the Docker image sets; the app's port is not published, and Caddy is the only public entry.

</details>

<details>
<summary><b>Why is the first login done in a terminal?</b></summary>

There is no web page on purpose. When there is no session, `agy` prints a login link; you open it, sign in and paste the code with `docker exec`. `/health` says whether the session is connected, as seen by a real `agy` check, never by configuration ([ADR 0009](docs/adr/0009-no-web-page-login-through-docker-exec.md)). The landing page is a separate static folder, `site/` ([ADR 0011](docs/adr/0011-landing-page-and-logo-in-the-repository.md)).

</details>

<details>
<summary><b>Does the login survive a container restart?</b></summary>

Yes, as long as the named volume `agy-gemini` is kept. `docker compose down` keeps it and `docker compose down -v` removes it, so you would log in again. Details are in [`docs/spike-results.md`](docs/spike-results.md).

</details>

## Roadmap

The full order, in groups, is in [#29](https://github.com/guilhermebkel/antigravity-connector/issues/29).

- [x] **Harness and structure:** monorepo, lint rules, architecture tests, CI and docs.
- [x] **Spike:** `agy` inside Docker, login and session persistence.
- [x] **Chat over `/v1`**, with streaming, structured output, conversations and image input.
- [x] **MCP** with `web_search`, `generate_image`, `research` and `browse`.
- [x] **Docker image, end-to-end tests and the real acceptance run** ([`docs/acceptance-2026-11.md`](docs/acceptance-2026-11.md)).
- [ ] **Not available yet:** tool calling, PDF and other file input, audio and video, a browser profile with your own logins.

## Contributing

Issues and pull requests are welcome. Start with [`AGENTS.md`](AGENTS.md), which says what to read for each kind of task.

### Development

Needs the Node version in `.nvmrc` and pnpm.

```bash
nvm use
pnpm install
pnpm dev     # the server with the fake agy on 127.0.0.1:8787
pnpm check   # typecheck, lint, quality, tests and build
```

The image smoke test is `scripts/image-smoke.sh` (it needs Docker).

A release is started by hand: run the `Release` workflow on `master` and pick `patch`, `minor` or `major` (`none` releases the current version). It checks everything, tags the commit, publishes the GitHub Release and the image to `ghcr.io/guilhermebkel/antigravity-connector`.

---

<p align="center">
  <strong>Your subscription. Your machine. One call at a time.</strong>
</p>

<p align="center">
  MIT License &copy; Guilherme Mota
</p>
