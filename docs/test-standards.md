# Test standards

How tests in this repository are written. `pnpm lint` enforces the rules marked **(lint)**, through Oxlint's Vitest rules and the rules in `docs/code-standards.md`, which apply to tests too; the rest are checked in review. Every rule serves one of two questions: would this test fail if the code broke, and is it testing the real code?

## Where tests live

- **Next to the code.** A test lives beside the file it tests and shares its name (`QueueService.ts` → `QueueService.test.ts`). There is no `test/` folder. Every test runs in Node.
- **Through the highest seam.** Test behavior through the routes and the MCP endpoint with the built server object and the fake agy. Test a lower module directly only for logic with many cases (queue, limits, redaction, envelope parsing).
- **Fixtures in the real format.** Outputs of `agy` (envelopes, stream events) are complete recorded outputs kept in a `Testing` folder; a fixture recorded from the real binary is preferred over one written by hand. Test doubles (the fake agy) live in `Testing`, which production code never imports.
- **Every new behavior brings its test.** Each new route, tool, output path or rule gets a test, with a fake secret where output is involved.

## The real `agy` is never called in tests or in CI

Tests run against the fake agy. The real binary needs the owner's login, spends subscription quota and can only run on the owner's machine. The acceptance run against the real binary is a separate, human step in the roadmap.

## Which level

Many fast low-level tests, few slow ones. Pick the lowest level that can fail for the behavior you are adding. The level is your choice as the agent that does the work, not the issue's: an issue says what to prove, never which kind of test.

- **Unit and service tests** for utils, schemas, services and adapters.
- **Server tests** for what a client sees: a real HTTP request, or a real MCP client, against the server with the fake agy.
- **End-to-end tests** against the built server for the few flows that need the whole process.

A bug found at a high level is first reproduced in a lower-level test, then fixed.

## What a test checks

- **Name the break.** Before writing the body, name the change to the code that should make the test fail. If you can't name one, the test checks nothing. A test that fails only when a constant or a message changes is a change detector.
- **Expected values come from outside the code.** Write them as literals worked out by hand from the fixture, never computed with the code under test or its constants.
- **Exact assertions (lint).** `toStrictEqual`, not `toEqual`. No `toBeDefined`, `toBeTruthy` or `toBeFalsy`. `toThrow` names the message.
- **No vacuous passes.** An assertion that something never appears passes on empty output too: first assert there was something to check.
- **One behavior per test, named by the behavior,** in the domain's words (`GLOSSARY.md`): "refuses a call over the daily limit", "keeps waiting calls in order".

## Test code stays simple

- **No logic in the test body (lint).** No `if` or `try` deciding which assertion runs. Cases that differ only in data are rows of `it.each`.
- **Same rules as the code (lint).** Complexity, nesting, parameters, nested calls and duplication apply to tests. Exemptions: magic numbers, external key spelling and `!`.
- **Wait for the condition, never for time (review).** Use `expect.poll`, `vi.waitFor` or a fake timer, never a fixed sleep.
- **Clean structure (lint).** No skipped, focused, commented-out or duplicated tests; hooks at the top of their block.

## Real code, doubles only at the edges

- **Run the real thing.** Real services, real schemas. Do not mock this repository's own modules: if a test needs that, the seam is wrong.
- **Doubles only where the process meets the outside:** the `agy` binary (the fake agy), the clock, the file system when needed. Assert what the code did with them.
- **Time is an input.** Pass timestamps in; tests never depend on the clock.
- **Production code has no test-only methods.**

## Safety tests

Behavior that cannot fail has a deterministic test and no exception: every output path returns and logs no secret (a fake one is planted and searched for); a request without the bearer key is refused on every route except `/health`; the server refuses a non-loopback bind unless allowed; a run is killed at its timeout. A change to one of these rules changes its test in the same PR.

## Before finishing: the mutation check

Go through the code you changed and imagine the realistic mistakes: a wrong threshold, the wrong branch, a missing redaction, a route that lets a call through without the key, an empty result, an off-by-one, something counted twice. Some test should fail for each. When none would, add or fix the test before committing.
