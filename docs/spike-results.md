# agy spike results

Investigation for issue #2: `agy` inside Docker, login, session persistence, fixtures and measurements.

Measured with `agy` 1.5.9, installed with the official installer, in a Linux sandbox (not a Docker container). Raw output is in `spike/fixtures/`, with conversation ids replaced by invented values.

**Status: partial.** Measured: S2, S4, S5 (chat and search), S6, S7, S8, S9 (the `-p` half), S10 (partial). Not measured: S3 (container recreate), S5 for image and browse, S9 (the `agy acp` half), S11.

## S1. Throwaway image and compose file

Done: `spike/Dockerfile` (Debian slim with Node 22, `agy` from the official installer) and `spike/docker-compose.yml` (named volume on `~/.gemini`).

Not built here: the Docker daemon is not running in this session, so `docker build` was not run. Owner's first `docker compose build` is still needed.

## S2. Output with no session

Measured. Command: `agy -p "ping" --output-format json` with no login. Result after a 60 s wait, exit 1. Raw text printed (the URL is replaced with `https://accounts.google.com/o/oauth2/EXAMPLE`):

    Authentication required. Please visit the URL to log in:
      https://accounts.google.com/o/oauth2/EXAMPLE
    Waiting for authentication (timeout 60s)...
    Or, paste the authorization code here and press Enter:
    Error: authentication timed out.
    error: authentication failed or timed out
    {"conversation_id":"","status":"ERROR","response":"","error":"authentication failed or timed out","duration_seconds":0,"num_turns":0,"usage":{"input_tokens":0,"output_tokens":0,"thinking_tokens":0,"cache_read_tokens":0,"total_tokens":0},"finished_reason":"error"}

Note: `-p` gives only 60 s to paste the code. The login has to happen through `agy acp --login` (S4).

## S3. Session survives a container restart and recreate

Not determined. The login is stored as a file under `~/.gemini/antigravity-cli/` (`antigravity-oauth-token`, mode 600). The Docker daemon is unavailable here, so a real recreate was not tested. Owner: after login, run `docker compose restart` and `docker compose up -d --force-recreate`, then `docker exec agy-spike agy -p "ping" --output-format json`.

Expected to hold, because the named volume keeps `~/.gemini`. That is a prediction until S3 is run.

## S4. `agy acp --login` without an interactive terminal

Measured: yes, with a caveat. `agy acp --login` printed the login URL and then waited on stdin. It was run in the background with stdin from a FIFO, not from a TTY. The code was written to the FIFO and the output read back `Logged in as <account>`. Exit was clean.

Caveat: the process still had an input stream, so it works without a TTY, but the owner's container run is still the real test.

## S5. Unattended `-p` runs and `--dangerously-skip-permissions`

Measured for chat and search: both ran with `-p` and no `--dangerously-skip-permissions`. No prompt stopped the run; each returned `status: SUCCESS`.

Not measured: the image and browse profiles.

## S6. Reasoning effort

Measured:

- `--effort low` and `--effort high` are both accepted; both returned `SUCCESS`.
- `--model gemini-3.8-flash-low` is accepted; it returned `SUCCESS`.

Not measured: combining the slug suffix and `--effort`, and invalid values. Token counts were similar across the efforts on a one-word prompt, so this does not show a cost difference.

## S7. Plan mode does not search or write files

Measured for a no-search prompt: `--mode plan` with "Do not search the web and do not write files" returned `hello` with no tool steps in `chat-stream.ndjson`. No `search_web` call and no file write.

Not measured: whether the model would call `search_web` under plan mode if a prompt asked it to, and whether `--sandbox` changes that.

## S8. Search measurements (three runs)

Measured, same prompt (current Node.js LTS):

| Run | Wall time | `duration_seconds` | `total_tokens` |
| --- | --- | --- | --- |
| 1 | 47.1 s | 44.7 | 19,530 |
| 2 | 22.1 s | 19.7 | 12,154 |
| 3 | 28.6 s | 26.1 | 14,677 |

The search stream has 6 `search_web` tool steps for one answer. Times vary a lot between runs.

## S9. Latency: `agy -p` per call against `agy acp`

Measured, `-p` half: five runs of `agy -p "Reply with the word ok."`: 7.2 s, 11.0 s, 11.5 s, 8.6 s, 7.8 s.

Not measured: `agy acp` against a persistent session, so no comparison yet.

## S10. Fixtures

Captured (see `spike/fixtures/README.md`): chat and search JSON envelopes, a chat model-slug envelope, a chat `stream-json` (plan mode), and a search `stream-json` with `step_type: tool` events. The image, error and raw no-session files were not captured as raw files; the no-session output is above.

The secret grep from issue #2 prints nothing over `spike/`. Conversation ids are replaced with `00000000-0000-4000-8000-000000000000`.

## S11. Recommendation between `agy -p` per call and `agy acp`

Not determined. The `-p` numbers are available (S9, `-p` half), but the `acp` comparison is not. Recommendation waits for it.

## Acceptance criteria

- **AC1** (every S2 to S9 has an answer or a reason): partly met. S2, S4, S5 (chat and search), S6, S7, S8 and the `-p` half of S9 are answered. S3, the image and browse part of S5, and the `acp` half of S9 are open, with reasons above.
- **AC2** (fixtures have no real data): met for the captured files. The grep is clean.
- **AC3** (session across a container recreate, with the workaround): not determined. Depends on S3.
