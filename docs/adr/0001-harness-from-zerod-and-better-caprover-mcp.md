# 0001. The harness comes from zerod and better-caprover-mcp

Status: accepted (2026-11-14)

## Context

This project is built mostly by agents that start from a fresh chat. Rules written only as text get broken; each one that a tool can check should be a lint rule, a type or a test.

## Decision

The lint rules, the local ESLint rules, the quality tools, the standards docs, the agent docs, the issue and pull request templates and the check scripts are adapted from the author's other projects: `guilhermebkel/zerod` (private; a pnpm and Turborepo monorepo with a Fastify server) and `guilhermebkel/better-caprover-mcp` (public; an MCP server over Streamable HTTP). Both grew from the same harness. The commands keep the same names and meaning (`pnpm check`, `pnpm check:changed`, `pnpm quality`), so agents and people find the same workflow everywhere. Oxlint (type-aware) runs almost every rule and a minimal ESLint runs the few that Oxlint cannot.

## Considered options

- Starting without a harness: rejected. The same mistakes come back in every chat.
- Copying a harness as it is: rejected. The web app, the browser tests, the card-game rules and the CapRover operations do not exist here, so their rules, scripts and docs were removed. Rules for this project were added: only `agy` spawns a process, nobody touches the credentials folder, package boundaries, and the environment is read in one place.

## Consequences

- `pnpm check` is the single gate, locally and in CI. A limit is never raised and an ignore is never added to pass.
- The base branch is `master`, not `main`.
- A rule that needs code this project does not have yet is marked in the standards and gets its tool in the pull request that adds the code.
