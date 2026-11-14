# 0008. No database in the MVP

Status: superseded by [0010](0010-sqlite-call-log-and-daily-counters.md) (2026-11-14)

## Context

The server needs state for the queue, the daily limits and the `agy` session. It is used by one person on one machine.

## Decision

No database in the MVP. The queue and the counters live in memory; the login state lives in the CLI's own folder, which only the binary reads. A restart resets the counters, which is acceptable for a personal server.

## Consequences

- A persistent call log and counters that survive a restart are a later, optional issue (SQLite).
- Nothing to migrate or back up, and no private content is stored by the app.
