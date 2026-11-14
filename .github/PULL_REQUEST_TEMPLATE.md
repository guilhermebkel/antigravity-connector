## What and why

<!-- One or two sentences. -->

## Linked issue

<!-- Closes #123. One pull request closes one issue. -->

## How I tested it

<!-- `pnpm check:changed` is the minimum; CI runs the full `pnpm check`. The real `agy` is never called in tests: say if you ran the server against it by hand. -->

- [ ] The acceptance criteria of the issue are met
- [ ] `pnpm check:changed` passes
- [ ] New behavior has a test next to the file it tests
- [ ] New output paths are redacted and tested with a fake secret
- [ ] A new MCP tool follows "Before merging a tool" in `docs/mcp-standards.md`: description with duration and quota, strict schema, `outputSchema`

## Checklist

- [ ] No API key, token, prompt, login link or server address anywhere in the diff
- [ ] Docs, `GLOSSARY.md` or an ADR updated if behavior or vocabulary changed
- [ ] If the Docker image changed, it was built and started
