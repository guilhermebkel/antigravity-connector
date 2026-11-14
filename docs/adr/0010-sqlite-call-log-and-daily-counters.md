# 0010. SQLite call log and daily counters that survive a restart

Status: accepted (2026-11-14). Supersedes [0008](0008-no-database-in-the-mvp.md).

## Context

The daily limits are the only guard on subscription use. In 0008 they lived in memory, so a restart reset them. The owner also wants a record of how often each route and tool runs, with the token counts, to tune the limits.

## Decision

- One SQLite file, `calls.sqlite`, in the directory named by `DATA_DIR` (`data` locally, `/data` in the image, on its own named volume, separate from the agy login).
- Node's built-in `node:sqlite`, so no native dependency and no build tools in the image.
- One row per call, written when the call ends: start time (UTC), door, route or tool, run kind, model, duration, input, output and total tokens, and the status (`success`, `error` or `stopped`).
- No column can hold a prompt, a response, a search query, a URL or an image. A test plants a marker in a prompt and checks the file does not contain it.
- At startup the daily counters are read from today's rows, so a restart does not reset them. Rows older than 90 days are deleted at startup.
- A `DATA_DIR` that cannot be written stops the server at startup, and the error names the directory.

## Consequences

- The limits now survive restarts, and the owner can count calls per route and tool with a SQL query.
- Calls that were running when the process stopped are not recorded, and the counter does not include them.
- The SQLite module is marked experimental by Node 22 and prints a warning on first use. It is accepted for this personal server; the warning goes to the container log.
- The MVP rule "no database" no longer holds. Any read API or UI for the log stays out of scope.
