# Acceptance run, November 2026 (issue #21)

First run of the server with the real `agy` (1.5.9) and a real login, inside the Docker image built from `apps/server/Dockerfile`.

## Environment

- Where: a cloud sandbox, not the owner's machine. The owner logged in to `agy` locally, and that login (the OAuth token file, nothing else) was copied into the named volume `agy-acceptance`, owned by the image's `agy` user.
- Image: built locally with the sandbox proxy CA added to a scratch copy of the Dockerfile (the committed Dockerfile is unchanged).
- Container: `antigravity-connector`, `HOST=0.0.0.0`, `ALLOW_NON_LOOPBACK_BIND=true`, published on `127.0.0.1:8787`, `AGY_BIN=agy`.
- Claude Code: `2.1.325`, run non-interactively with `claude -p`.
- Not included in this document: the API key, the login URL, and any private content. The prompts below are short and neutral.

## Results

| Step | Result |
| --- | --- |
| S1 start and login | Pass. `/health` returns `{"status":"ok","agy":"connected"}`. |
| S2 AI SDK measurements | Pass. Table below. |
| S3 web search through Claude Code | Pass. Claude Code called `web_search`; the answer came back in 15 s end to end. |
| S3 image through Claude Code | Fail. Image model returned 429 (quota). See follow-up #38. |
| S4 wait or timeout, progress | Fail. Claude Code stopped waiting at about 60 s. Progress notifications were not visible in the `json` output mode. See follow-up #39. |
| S5 plain chat triggers tools | Pass. A plain chat in plan mode made 0 tool steps. |
| S6 restart keeps the session | Pass. After `docker restart`, `/health` reports `connected`; the logs have no login block. |
| S7 this document and follow-ups | Done. Follow-ups #38 and #39. |

### S2: AI SDK against both models

Script: `scripts/acceptance/measure.mjs`, prompt `Reply with the word ok.`, two runs per model and mode, default effort (`medium`). Times are wall clock on the client.

| Model | Mode | Run | First token | Total | Total tokens |
| --- | --- | --- | --- | --- | --- |
| gemini-4-argon | generateText | 1 | – | 8.68 s | 9731 |
| gemini-4-argon | generateText | 2 | – | 10.80 s | 9875 |
| gemini-4-argon | streamText | 1 | 6.08 s | 6.23 s | 9497 |
| gemini-4-argon | streamText | 2 | 7.38 s | 7.51 s | 9701 |
| gemini-3.8-flash | generateText | 1 | – | 5.38 s | 9849 |
| gemini-3.8-flash | generateText | 2 | – | 5.77 s | 9981 |
| gemini-3.8-flash | streamText | 1 | 4.72 s | 4.89 s | 9771 |
| gemini-3.8-flash | streamText | 2 | 5.22 s | 5.40 s | 9950 |

In these runs `agy` sent its answer in very few deltas, so the first token arrives close to the end. Streaming does not save time for short answers; it does give the same text and usage as the non-streaming call.

### S3 and S4: Claude Code over `/mcp`

Registered with `claude mcp add --transport http antigravity http://127.0.0.1:8787/mcp --header "Authorization: Bearer <key>"`, removed after the run.

- Web search, prompt `Use the antigravity web_search tool to find the current Node.js LTS version...`: Claude Code made the call, answered in one sentence, and reported the source. Total 15 s. The answer did not include the direct link to the release schedule; the tool description should say the sources list can be empty or partial.
- Image, prompt `Use the antigravity generate_image tool to create a small picture of a red circle on white...`: three attempts in total (Claude Code retried twice on its own). Server log:
  - attempt 1: 57 s, `agy_failed`, message "agy finished without a PNG file";
  - attempt 2: cut off by the client at 60 s, `agy_failed` (the server logged the cancellation);
  - attempt 3: 19 s, `agy_failed`, same message.
  - Reproduced inside the container: the image model returned `429 RESOURCE_EXHAUSTED` ("quota resets after approximately 2 hours and 48 minutes"). agy reported `SUCCESS` with no file. Follow-up #38.
- Waiting: Claude Code gave up at about 60 s. Whether a progress notification resets that timer is not measured yet. Follow-up #39.
- Progress notifications: not observed. The run used `--output-format json`, which hides them. The server sends them only when the client sends a progress token.

Because of the quota, the image path is not proven by this run. The same path was proven with the fake agy in CI (#20) and in the spike (#2, a real 397 KB PNG before the quota ran out).

### S5: plain chat and tools

- `Say hi in one short sentence. Do not search the web and do not write files.`, `--mode plan`, `stream-json`: 0 tool steps, for `gemini-3.8-flash-low` and `gemini-4-argon-low`. The `search_web` text appears only in the init event's tool list.
- `Search the web for the current Node.js LTS version and cite a link.`, same flags: 8 tool steps, 7 of them `search_web`. Plan mode does not block search when the prompt asks for it, so the instruction in the prompt is the only guard for plain chats.

### S6: restart

`docker restart antigravity-connector`, then `/health` after 12 s: `connected`. The volume was not removed.

### Acceptance criteria

- AC1 (each of S2 to S6 has a result, with numbers where asked): met. The image path has no real result because of the quota; that is recorded above.
- AC2 (failures have follow-up issues linked from this document): met. #38 for the image quota message, #39 for the Claude Code timeout.

## Follow-ups

- [#38](https://github.com/guilhermebkel/antigravity-connector/issues/38): image failure reason (quota) reported as "no file".
- [#39](https://github.com/guilhermebkel/antigravity-connector/issues/39): Claude Code gives up on a long `generate_image` call at about 60 s.

## Tool descriptions and measured durations (S7)

- `web_search`: "about 20 to 45 seconds" stays. The run measured 15 s end to end through Claude Code and 19.7 to 44.7 s in the spike.
- `generate_image`: "about a minute" stays. Spike 54 s. The failed attempts took 19 s and 57 s; a success under load was not measured. Revisit when #39 is answered.
