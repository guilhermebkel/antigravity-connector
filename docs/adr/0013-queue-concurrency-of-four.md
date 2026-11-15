# 0013. The queue runs up to four agy calls at once

Status: accepted (2026-11-15). Supersedes the concurrency part of [0006](0006-api-and-mcp-in-one-process-with-one-queue.md); the single queue, the daily limits and the MCP transport stay as they were.

## Context

The owner asked for more than one call at a time. [0006](0006-api-and-mcp-in-one-process-with-one-queue.md) set concurrency 1 because each call spawns `agy`, which is slow and spends the subscription. Image and research calls take about a minute and up to several minutes, so one long call blocks every call behind it.

## Decision

- The global queue runs up to `QUEUE_CONCURRENCY` calls at once. The default is 4, and the value must be from 1 to 8.
- Calls past that number wait in the same queue, with the same `QUEUE_MAX_WAIT_MS` limit as before.
- The daily limits still count calls, not runs, so the cost per day does not change.
- Unit tests of the queue and of the agy run service keep concurrency 1, so they test the serial order on purpose.

## Considered options

- Keep concurrency 1 and rely on the MCP job pattern for long calls: rejected by the owner, who wants calls to run in parallel.
- A separate queue per door: rejected, for the reason in 0006. Two queues would not share one limit.

## Consequences

- Up to four `agy` processes run at once. Each run has its own working directory, so their output files do not mix.
- Not verified: that the real `agy` accepts several runs at once under one login. The tests use a fake agy. Check it on the VPS with two calls at the same time before relying on it.
- Browse calls start a Chrome each, so four of them use more memory on the VPS.
