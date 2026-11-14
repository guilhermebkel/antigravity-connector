# agy spike results

Investigation for issue #2: `agy` inside Docker, login, session persistence, fixtures and measurements.

**Status: partial.** The container scaffold exists (`spike/Dockerfile`, `spike/docker-compose.yml`). Nothing below S2 has been measured, because every step needs the owner's Google AI Pro login, which an unattended agent cannot perform. Each section records what is still missing and how the owner can answer it.

## How to run the spike (owner)

    cd spike
    docker compose up -d --build
    docker exec -it agy-spike agy        # S2: login, then copy the text printed with no session

Replace the printed URL with `https://accounts.google.com/o/oauth2/EXAMPLE` before pasting any output here.

## S1. Throwaway image and compose file

Done. `spike/Dockerfile` (Debian slim with Node 22, `agy` installed with the official installer) and `spike/docker-compose.yml` (named volume on `~/.gemini`).

Not verified by a build in this PR. The first `docker compose build` is part of the owner's run above.

## S2. Output with no session

Could not be determined: needs a login. Owner: capture the text `agy` prints in `spike/fixtures/no-session.txt`.

## S3. Session survives a container restart and recreate

Could not be determined: needs a login. Owner: after S2, run `docker compose restart` and `docker compose up -d --force-recreate`, then `docker exec agy-spike agy -p "ping" --output-format json`. Record whether it answers without a new login.

## S4. `agy acp --login` without an interactive terminal

Could not be determined: not attempted. Needs a container and the owner's account to test.

## S5. `--dangerously-skip-permissions` for unattended runs

Could not be determined: needs a login. Owner: run each profile (chat, search, image, browse) with `-p` and record whether it stops for permission.

## S6. Reasoning effort selection

Could not be determined: needs a login. Owner: try slug suffix (`gemini-3.8-flash-low`), `--effort`, and both, and record which are accepted.

## S7. Plan mode does not search or write files

Could not be determined: needs a login. Owner: run chat with `--mode plan` and an instruction not to search, then check for `search_web` calls and written files. If present, record whether `--sandbox` stops them.

## S8. Search measurements (time, `total_tokens`, three runs)

Could not be determined: needs a login.

## S9. Latency: `agy -p` per call against `agy acp`, five runs each

Could not be determined: needs a login.

## S10. Fixtures

Not captured. The list and the secret checks are in `spike/fixtures/README.md`.

## S11. Recommendation between `agy -p` per call and `agy acp`

Could not be determined: depends on S4 and S9. No recommendation is made yet.

## Acceptance criteria

- **AC1** (every S2 to S9 has an answer or a reason): not met. All of S2 to S9 are open.
- **AC2** (fixtures have no real data): not applicable yet. No fixture is committed.
- **AC3** (session across a container recreate, with the workaround): not determined. Depends on S3.
