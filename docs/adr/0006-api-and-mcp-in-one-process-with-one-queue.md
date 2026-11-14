# 0006. API and MCP in one process, MCP over Streamable HTTP only, one global queue

Status: accepted (2026-11-14)

## Context

Every call spawns the `agy` binary, which is slow, spends subscription quota and is risky to run in parallel. Two doors reach it: the OpenAI-compatible API and the MCP server.

## Decision

Both doors live in one Node process (`apps/server`) and share one global queue with concurrency 1. MCP is served only over Streamable HTTP under `/mcp`, behind the same bearer key as `/v1`. MCP over stdio is out of scope.

## Considered options

- Two processes, one per door: rejected. Each would need its own queue, so the limit of one run at a time would not hold.
- MCP over stdio: rejected. A stdio client starts its own process, which brings back the second queue.

## Consequences

- One place enforces the queue, the daily limits and the redaction for both doors.
- MCP sessions are stateful, capped and expire; the cap and the idle time are configuration.
- A client that wants MCP connects over HTTP with the API key.
