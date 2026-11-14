# antigravity-connector

A personal, localhost-only Docker server that exposes a Google AI Pro subscription through two doors in one process: an OpenAI-compatible API under `/v1` and an MCP server (Streamable HTTP) under `/mcp`. Every call is served by the official Antigravity CLI (`agy`), run as a subprocess. The app never reads or forwards the CLI's login token.

This repository is being built issue by issue. Start with the execution order in issue #29 and the project brief in issue #1.

## Develop

    nvm use            # Node 22
    pnpm install
    pnpm check         # typecheck, lint, quality, tests, build

`AGENTS.md` lists every command and tells an agent where to read before each kind of task.

## License

MIT
