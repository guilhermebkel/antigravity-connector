# 0007. Fastify for the HTTP server

Status: accepted (2026-11-14)

## Context

The server needs a small HTTP layer for the OpenAI-compatible routes, an MCP endpoint and `/health`, with bearer authentication, rate limiting and server-sent events.

## Decision

Fastify. The author's other server (`zerod`) uses it, so the structure and the lint rules carry over; it has first-class schemas, hooks for authentication and rate limiting, and handles streaming responses.

## Considered options

- Express: rejected. No built-in schema validation or typed hooks, and the harness is already shaped around Fastify.
- Hono: rejected. Good fit for edge runtimes, which this project does not use.

## Consequences

- Routes are thin: they parse with a Zod schema and call `core`.
- Fastify is imported only in `apps/server` and the packages that register routes.
