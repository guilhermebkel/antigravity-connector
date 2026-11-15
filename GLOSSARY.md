# Glossary

The words this project uses, one meaning each. Use them in issue titles, test names, code and docs.

| Term | Meaning |
| --- | --- |
| **Door** | One of the two ways a client reaches the server: the OpenAI-compatible API (`/v1`) or the MCP endpoint (`/mcp`). `/health` is not a door. Both doors live in one process and share one queue. |
| **agy** | The official Antigravity CLI binary. The server runs it as a subprocess for every call. It is the only thing that holds the Google login. |
| **agy session** | The login state of the `agy` binary inside the container. It is *connected* only after a real `agy` check succeeds, never by configuration. |
| **Run** | One execution of the `agy` binary for one call, with a timeout, in a fresh empty temporary directory that is removed afterwards. |
| **Run kind** | What a run is for: `chat`, `search`, `research`, `image` or `browse`. Each kind has its own daily limit. |
| **Run profile** | The fixed set of flags, working directory rules and prompt shape that `core` asks `agy` to use for one run kind. |
| **Envelope** | The single JSON object `agy` prints with `--output-format json`: `conversation_id`, `status`, `response`, `usage` and, with a JSON schema, `structured_output`. |
| **Stream event** | One line of NDJSON that `agy` prints with `--output-format stream-json`: `init`, `step_update` (carrying `text_delta`) or `result`. |
| **Tool** | One MCP tool a client can call on `/mcp` (`web_search`, `generate_image`, `research`, `browse`). Not an `agy` tool. |
| **Call log** | The SQLite table with one metadata row per call (door, route or tool, kind, model, duration, token counts, status). It never stores content. The daily counters are read from it at startup. |
| **Conversation id** | The id `agy` returns for a conversation. The API keeps the ids it has seen for 24 hours, at most 256; a request that sends a known id resumes that conversation with only its last user message. |
| **Attachment** | An image sent in a chat message as a `data:` URL. The server saves it in the run's temporary directory and names the file in the prompt, so agy can read it with its own tools. |
| **Structured output** | The JSON that `agy` returns for a `response_format` with a schema, passed to agy as a schema file (`--json-schema`). The API returns it as the message content. |
| **Queue** | The global queue with concurrency 1 that serializes every run from both doors. A call that waits longer than the maximum fails with a clear error. |
| **Daily limit** | The number of runs of one kind allowed per UTC day. A call over the limit fails before the queue. |
| **Fake agy** | A small script that behaves like `agy` for tests and for `pnpm dev`: it prints canned envelopes and stream events, so no test ever calls the real binary. |
| **Fixture** | A real output recorded from `agy` (an envelope, a stream) and stored for tests. Recorded fixtures are preferred over written ones. |
| **Loopback bind** | The default of listening on `127.0.0.1` only. A non-loopback `HOST` needs `ALLOW_NON_LOOPBACK_BIND=true`, which the Docker image sets so the published port can be reached. |
| **Login link** | The Google URL that `GET /v1/auth` (or `check_auth`) returns when agy is not logged in. It is bound to one login attempt and lasts 60 seconds. |
| **Authorization code** | The code the Google login page shows after sign-in. The client sends it once to `POST /v1/auth` (or `set_auth`); the server forwards it to agy and never stores or logs it. |
| **API key** | The bearer secret (`API_KEY`) that every route except `/health` requires. |
| **Public model id** | The model name a client sends, such as `gemini-4-argon` or `gemini-3.8-flash`. Each maps to one `agy` slug per reasoning effort; an unknown id or effort has no slug and is refused. |
| **Reasoning effort** | The `low`, `medium` or `high` level a client asks for. It selects the `agy` slug of the public model id. |
