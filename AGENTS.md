# antigravity-connector

A personal, localhost-only Docker server that exposes the owner's Google AI Pro subscription through two doors in one Node process: an OpenAI-compatible API under `/v1` and an MCP server (Streamable HTTP) under `/mcp`. Every call spawns the official Antigravity CLI, `agy`. The server has no web page; the landing page is a separate static folder (`site/`, ADR 0011). Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`; planned work is in GitHub issues (the execution order is the roadmap issue; the project brief is issue #1).

## Layout

pnpm workspaces and Turborepo. Each package imports its own files through its package name (`@antigravity-connector/<package>/Folder/File.ts`) and other packages only through their root. There is no build step between packages.

- `apps/server/`: the only process. Fastify; mounts the API, the MCP endpoint and `/health`.
- `packages/api/`: the OpenAI-compatible routes. Nothing outside the OpenAI format. Never imports `agy` or `mcp`.
- `packages/mcp/`: the MCP surface: tool manifest, input and output schemas. Never imports `agy` or `api`.
- `packages/agy/`: the only place that runs the `agy` binary (spawn, timeout, envelope parsing) and the fake agy for tests. The only package that may import `child_process`.
- `packages/core/`: the global queue, daily limits, agy session state, environment, logging, shared errors. Imports `protocol` and `agy`.
- `packages/protocol/`: shared types and Zod schemas. Imports no other package.
- `packages/tooling/`: the shared tsconfig and our local lint rules (`eslint-local-rules.mjs`).
- `scripts/`: harness scripts and their tests (lint, `check:changed`, architecture and doc-path tests).
- `site/`: the landing page, a static folder published to GitHub Pages. Not part of the server or the image. `scripts/site-version.mjs` sets its version and date on a release.
- `design/`: the logo kit and the scripts that generate it (`design/README.md`). Not part of the image or of `pnpm check`.
- Layers inside a package, from the bottom: `Errors`, `Protocols` (types only), `Schemas` (Zod), `Utils` (static helpers), `Services` (rules; dependencies through the constructor), `Adapters`, `Setup`; `Tools` (MCP tools) and `Routes` (HTTP routes) are the top layers of their packages. `Testing` holds doubles and fixtures; only tests import it. Folders are created when the first file needs them.
- Every file in a mapped folder ends its name with the folder's name, singular (`QueueService.ts`; lint `local/file-suffix`). One class per file. Tests sit next to the file they test (`*.test.ts`).

## Commands

    nvm use            # Node 22
    pnpm ensure-deps   # pnpm install when package.json or the lockfile changed
    pnpm dev           # the server, with the fake agy (once the server exists)
    pnpm test          # Vitest, every package and the scripts
    pnpm test:changed  # tests related to files changed against origin/master
    pnpm typecheck     # Turborepo, per package
    pnpm lint          # Oxlint (type-aware) and a minimal ESLint, in parallel
    pnpm lint:fix
    pnpm quality       # knip, jscpd, dpdm (cycles per package)
    pnpm build
    pnpm check:changed # what the branch changed against origin/master (run before a commit)
    pnpm check         # everything (CI runs it, split in parallel jobs)

## How to act on a task

| When | Read | Run |
| --- | --- | --- |
| Starting a session | `README.md` | `nvm use`, `pnpm ensure-deps` |
| Given a GitHub issue number | `docs/agents/issue-tracker.md` | `gh issue view <n> --comments` |
| Triage labels on an issue | `docs/agents/triage-labels.md` | — |
| Domain terms or an ADR | `docs/agents/domain.md`, `GLOSSARY.md`, `docs/adr/` | — |
| Writing or changing code | `docs/code-standards.md` | — |
| Writing or changing tests | `docs/test-standards.md` | `pnpm test:changed` |
| Adding or changing an MCP tool | `docs/mcp-standards.md`, `docs/code-standards.md` ("Boundaries and security") | `pnpm test` |
| Running or spawning `agy` | `docs/adr/0003-shell-out-to-agy-instead-of-using-the-token.md`, the brief in issue #1 | — |
| Before committing | `docs/code-standards.md` ("Before committing"), `.github/PULL_REQUEST_TEMPLATE.md` | `pnpm check:changed` |
| Full verification (CI gate) | `.github/PULL_REQUEST_TEMPLATE.md` | `pnpm check` |
| Changing the harness | `docs/harness-standards.md` | `pnpm check:changed` |
| Changing the landing page or the logo | `design/README.md`, `docs/adr/0011-landing-page-and-logo-in-the-repository.md` | `pnpm test` |
| Writing or moving docs | `docs/docs-standards.md` | — |

## Rules

- Commit once per task, after a clean `pnpm check:changed`; CI runs the full `pnpm check` as the gate. Never raise a limit or add an ignore to pass.
- Start new work on a branch from `master` and open a pull request; `.github/PULL_REQUEST_TEMPLATE.md` has the checklist.
- Branch names are `<type>/<short-name>` in lowercase kebab-case: `feat` (new behavior), `fix` (bug fix) or `chore` (anything else). For issue work the name starts with the issue number: `feat/<n>-short-slug`.
- The pull request body starts with `Closes #<n>`; one pull request closes one issue.
- Code, tools, docs and ADRs are in English.
- Only `packages/agy` may import `child_process` (lint `local/no-child-process-outside-agy`). `packages/api` and `packages/mcp` never import `agy` or each other (lint `local/package-boundaries`, and `scripts/architecture.test.mjs` for `package.json`).
- No source file mentions the credentials folder of the CLI, and the app never reads, copies, logs or forwards the CLI's login token (lint `local/no-gemini-path`).
- Rules that cannot fail (auth, the loopback bind, the queue, the daily limits, redaction) live in code with a test, never only in a prompt or a comment.
- Private content (prompts, messages, search queries, image bytes, the `API_KEY`) is never logged. Every new output path is redacted and tested with a fake secret.
- `process.env` is read only in `EnvUtil` (lint `local/no-process-env`). Logs go only through `LogUtil`.
- Code that keeps an old stored shape from breaking carries a comment with `@legacy`. Nothing else gets backward compatibility.
- When behavior or vocabulary changes, update `GLOSSARY.md`, the docs or an ADR in the same PR.
