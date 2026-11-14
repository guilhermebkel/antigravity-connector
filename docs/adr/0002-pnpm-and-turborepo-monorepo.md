# 0002. pnpm workspaces and Turborepo

Status: accepted (2026-11-14)

## Context

The project has two doors (an OpenAI-compatible API and an MCP server), one place that runs the `agy` binary, shared rules and shared types. The dependency direction between them is a rule that cannot fail: the doors never reach `agy` and never reach each other.

## Decision

One repository with pnpm workspaces (`apps/*`, `packages/*`) and Turborepo running `build`, `typecheck` and `cycles` per package with a cache. Packages are named `@antigravity-connector/<package>` and are consumed as source: `exports` points at `src`, so there is no build step between them. Each package imports its own files through its own name, and other packages only through their root.

## Consequences

- A package boundary is a `package.json` dependency and an import path, so a lint rule and an architecture test can check it.
- A package can be type-checked and tested alone.
- The server bundle, when it exists, inlines the workspace packages.
