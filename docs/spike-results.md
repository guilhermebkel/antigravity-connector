# agy spike results

Investigation for issue #2: `agy` inside Docker, login, session persistence, fixtures and measurements.

Measured with `agy` 1.5.9 from the official installer, in a Linux sandbox and in Docker containers built from `spike/Dockerfile` (with one test-only change, see S1). Raw output is in `spike/fixtures/`, with conversation ids replaced by invented values.

**Status: complete for the questions in the issue**, with the reasons below for the parts that could not be fully determined.

## How to run the spike (owner)

    cd spike
    docker compose up -d --build
    docker exec -it agy-spike agy acp --login      # log in once; paste the code printed in the terminal
    docker exec agy-spike agy -p "ping" --output-format json

## S1. Throwaway image and compose file

Done: `spike/Dockerfile` (Debian slim with Node 22, `agy` from the official installer, a non-root `agy` user, `~/.gemini` created with the right owner) and `spike/docker-compose.yml` (named volume on `~/.gemini`).

Two fixes came from building it:

- The installer step was `curl | bash`, and that hid a failed download: the build passed with no `agy` installed. The step now has `pipefail` and checks that `agy` exists.
- The named volume was created owned by `root`, so `agy` could not write its login. The image now creates `~/.gemini` owned by `agy`, and Docker copies that owner to the volume.

Test-only change, not in the repository: the sandbox uses a proxy with its own CA, so the installer's HTTPS check failed inside the container. The test build added the sandbox CA. The Docker Hub limit (429) also blocked pulling the base image, so the test build used the image from the first build as its base. The owner's first `docker compose build` on a normal network is still the check for the base step.

## S2. Output with no session

Measured, in the sandbox and in the container. Command: `agy -p "ping" --output-format json` with no login. It waits 60 s for a code, then exits 1. Raw text (URL replaced with `https://accounts.google.com/o/oauth2/EXAMPLE`):

    Authentication required. Please visit the URL to log in:
      https://accounts.google.com/o/oauth2/EXAMPLE
    Waiting for authentication (timeout 60s)...
    Or, paste the authorization code here and press Enter:
    Error: authentication timed out.
    error: authentication failed or timed out
    {"conversation_id":"","status":"ERROR","response":"","error":"authentication failed or timed out","duration_seconds":0,"num_turns":0,"usage":{"input_tokens":0,"output_tokens":0,"thinking_tokens":0,"cache_read_tokens":0,"total_tokens":0},"finished_reason":"error"}

Login has to go through `agy acp --login` (S4), because `-p` gives only 60 s to paste the code.

## S3. Session survives a container restart and recreate

Measured. The login lives in `~/.gemini/antigravity-cli/` (`antigravity-oauth-token`, mode 600). Test: copy the existing session into a named volume mounted at `/home/agy/.gemini`, then:

- `agy -p ping` in the container: `SUCCESS`.
- Container removed and a new one started on the same volume: `SUCCESS`.
- `docker restart` of that container: `SUCCESS`.

So the session survives both a restart and a recreate, as long as the volume is kept.

Limit: the session was copied from the host, not created inside the container. The test shows the volume keeps the login. It does not test a fresh login done inside a container.

Workaround: keep the named volume (`docker compose down` without `-v`). If the volume is removed, log in again with `agy acp --login`.

## S4. `agy acp --login` without an interactive terminal

Measured. `agy acp --login` printed the login URL and waited on stdin. It ran in the background with stdin from a FIFO (no TTY). The code was written to the FIFO and the output read `Logged in as <account>`, with a clean exit.

## S5. Unattended runs and `--dangerously-skip-permissions`

Measured, without the flag, for each profile:

- **Chat** (`ping`, plan mode): `SUCCESS`, no permission stop.
- **Search** (three runs and a stream run): `SUCCESS`, no permission stop; 6 `search_web` tool steps for one question.
- **Image**: the run ended `SUCCESS`, but the built-in generator returned `image failed to generate: no image generated in response`. The model then wrote a 256×256 PNG with a Python script (`run_command`). So image generation did not work on this account, and the `SUCCESS` status does not mean an image was generated.
- **Browse**: the run ended `SUCCESS` with the page title "Example Domain", but no browser tool was called. The model said browser tools need the `/browser` command. So the browse profile is **not determined**: this answer does not show that browsing works.

Conclusion: no profile here needed `--dangerously-skip-permissions` to run unattended. The image and browse profiles still need a check of their own before the adapter relies on them.

## S6. Reasoning effort

Measured:

- `--effort low` and `--effort high` are accepted; both `SUCCESS`.
- `--model gemini-3.8-flash-low` is accepted; `SUCCESS`.

Not measured: combining the slug suffix and `--effort`, and invalid values. On a one-word prompt the token counts were close across efforts (9,428 for low, 9,447 for high), so this does not show a cost difference.

## S7. Plan mode does not search or write files

Measured for a no-search prompt. `--mode plan` with "Do not search the web and do not write files" answered `hello`, and the stream has no tool steps: no `search_web` call and no file write.

Not measured: whether a prompt that asks for a search under plan mode is blocked, and whether `--sandbox` changes that.

## S8. Search measurements (three runs)

Same prompt (current Node.js LTS):

| Run | Wall time | `duration_seconds` | `total_tokens` |
| --- | --- | --- | --- |
| 1 | 47.1 s | 44.7 | 19,530 |
| 2 | 22.1 s | 19.7 | 12,154 |
| 3 | 28.6 s | 26.1 | 14,677 |

Times vary a lot between runs.

## S9. Latency: `agy -p` per call against `agy acp`

Same short prompt (`Reply with the word ok.`), five runs each.

- `agy -p` (new process per call), wall time: 7.2 s, 11.0 s, 11.5 s, 8.6 s, 7.8 s.
- `agy acp --stdio` (one process, one session, five prompts), time per `session/prompt`: 4.6 s, 4.1 s, 6.0 s, 4.2 s, 4.7 s.

The `acp` figure does not include session creation (one call before the loop, not timed). The `acp` path is about 40 % faster per prompt here. Only short prompts were measured.

## S10. Fixtures

Captured in `spike/fixtures/` (see its README): chat, search and image envelopes or streams; plan-mode and browse streams; and the container chat after recreate. The image and error envelopes were not captured as separate files; the no-session output is in S2.

Redaction: conversation ids are replaced with `00000000-0000-4000-8000-000000000000`, and the secret grep from issue #2 prints nothing over `spike/`.

## S11. Recommendation between `agy -p` per call and `agy acp`

Recommendation: **`agy acp`** for the adapter.

Why: it is faster per prompt (S9), and it keeps one session open, so it does not pay process start-up on each call. Login works through `agy acp --login` (S4), and the session survives restart and recreate with a volume (S3).

What is still open before the adapter is written:

- how `agy acp` behaves when its process dies in the middle of a prompt (not tested);
- how a long-running `acp` process is restarted by the server (not tested);
- image and browse profiles (S5), which must be proven before the adapter relies on them.

## Acceptance criteria

- **AC1** (every S2 to S9 has an answer or a reason): met. Each item has a result or the reason it could not be determined (S5 browse and image, S6 combinations, S7 search under plan mode).
- **AC2** (fixtures have no real data): met. The grep is clean; conversation ids are replaced.
- **AC3** (session across a container recreate, with the workaround): met. The session survives recreate on a named volume (S3), and the workaround is written above.
