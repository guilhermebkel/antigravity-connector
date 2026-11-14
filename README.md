# antigravity-connector

A personal, localhost-only Docker server that exposes a Google AI Pro subscription through two doors in one process:

- an OpenAI-compatible API under `/v1` (`POST /v1/chat/completions`, `GET /v1/models`);
- an MCP server (Streamable HTTP) under `/mcp`, with the `web_search` and `generate_image` tools.

Every call runs the official Antigravity CLI (`agy`) as a subprocess. The server never reads, copies or forwards the CLI's login token, and never calls Google directly. The server has no web page: the login link is printed in the container logs, and the code is entered with `docker exec`.

## Risk note

Running a subscription through a local tool is not something Google documents for the CLI. Its terms, its limits and the CLI itself can change at any time, and a call can fail or be refused. Use it for yourself, on your own machine, at a low volume. Keep the API key secret: anyone who has it can spend your daily limits.

## Requirements

- Docker with Compose.
- A Google account with an AI Pro subscription.

## Quick start

    cp .env.example .env                 # then set API_KEY to a random value of at least 24 characters
    docker compose up -d --build
    docker logs antigravity-connector    # shows the login block if agy is not logged in yet
    curl http://127.0.0.1:8787/health

## Logging in

The first start has no session, so the server logs a login block with a URL and a command:

1. Read the link: `docker logs antigravity-connector`.
2. Open the URL in a browser, sign in, and copy the code it shows.
3. Run `docker exec -it antigravity-connector agy` and paste the code.
4. Check: `curl http://127.0.0.1:8787/health` returns `{"status":"ok","agy":"connected"}`.

The login is kept in the named volume `agy-gemini`. `docker compose down` keeps it; `docker compose down -v` removes it, and you must log in again.

## Using the API

With `curl`:

    curl http://127.0.0.1:8787/v1/chat/completions \
      -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
      -d '{"model":"gemini-3.8-flash","reasoning_effort":"low","messages":[{"role":"user","content":"Say hello in one word."}]}'

With the Vercel AI SDK (`@ai-sdk/openai-compatible`):

    import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
    import { generateText } from "ai";

    const provider = createOpenAICompatible({
      name: "antigravity",
      baseURL: "http://127.0.0.1:8787/v1",
      apiKey: process.env.API_KEY,
    });
    const { text } = await generateText({ model: provider("gemini-3.8-flash"), prompt: "Say hello in one word." });

## Connecting Claude Code to `/mcp`

    claude mcp add --transport http antigravity http://127.0.0.1:8787/mcp \
      --header "Authorization: Bearer <API_KEY>"

The `web_search` tool returns a short answer with links. A search takes about 20 to 45 seconds and counts against `DAILY_LIMIT_SEARCH`.

The `generate_image` tool returns one PNG image. A call takes about a minute and counts against `DAILY_LIMIT_IMAGE`.

When the client sends a progress token, the server reports progress while a call waits in the queue and runs. A client that cancels a call stops the agy process.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `API_KEY` | none (required, at least 24 characters) | The bearer token every route except `/health` requires. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the image) | The address the server listens on. |
| `ALLOW_NON_LOOPBACK_BIND` | `false` (`true` in the image) | Allows a non-loopback `HOST`. Only for Docker, with the port published on `127.0.0.1`. |
| `PORT` | `8787` | The port. |
| `AGY_BIN` | `agy` | The agy binary. |
| `AGY_TIMEOUT_MS` | `300000` | A call that runs longer is stopped. |
| `QUEUE_MAX_WAIT_MS` | `120000` | A call that waits longer in the queue is refused. |
| `DAILY_LIMIT_CHAT` / `_SEARCH` / `_IMAGE` / `_RESEARCH` / `_BROWSE` | `200` / `50` / `20` / `5` / `20` | Calls per UTC day, per kind. `0` refuses that kind. |
| `HTTP_MAX_REQUESTS_PER_MINUTE` | `120` | Requests per minute, counted separately for failed and valid authentications. |
| `MCP_MAX_SESSIONS` | `8` | MCP sessions open at once. |
| `MCP_SESSION_TTL_MS` | `1800000` | An MCP session idle for longer expires. |

## Limits and what is not supported yet

- One agy call runs at a time. Calls from the API and from MCP share one queue.
- Calls are slow: a chat answer takes seconds, a search takes tens of seconds.
- Streaming works with `stream: true` (Server-Sent Events, OpenAI chunk format). Set `stream_options.include_usage` to get the usage in the last chunk.
- Not available yet: tool calling (`tools` returns 400, because agy runs its own tools), `response_format` other than text, image input, the `research` and `browse` tools, and `POST /v1/images/generations`.
- Sampling parameters (`temperature`, `top_p`, `max_tokens`, `max_completion_tokens`) are accepted and ignored. The response header `x-antigravity-connector-ignored-params` lists the ones you sent.
- The agy binary is pinned to version 1.5.9 in the image. It cannot update itself, because it is installed read-only for the server user.

## Troubleshooting

- **`/health` says `login_required` after a restart.** The login is gone: the volume was removed or the image was rebuilt without it. Log in again (see above). A restart or a recreate with the same volume keeps the login.
- **`503` with `queue_timeout`.** Another call held the queue longer than `QUEUE_MAX_WAIT_MS`. Retry in a moment.
- **`429` with `daily_limit_reached`.** The limit for that kind is used up. It resets at the next UTC midnight, and the message says when.
- **`504` with `agy_timeout`.** The call ran longer than `AGY_TIMEOUT_MS` and was stopped. Ask a shorter question.
- **`502` with `agy_failed`.** agy failed. The container logs show the cause without the prompt or the answer.
- **The container stops at once with a message about `API_KEY`.** `.env` is missing the key, or the key is shorter than 24 characters.

## Develop

    nvm use            # Node 22
    pnpm install
    pnpm dev           # the server with the fake agy on 127.0.0.1:8787
    pnpm check         # typecheck, lint, quality, tests, build

`AGENTS.md` lists every command and tells an agent where to read before each kind of task. The image smoke test is `scripts/image-smoke.sh` (it needs Docker).

## License

MIT
