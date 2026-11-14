# Code standards

How code in this repository is written. `pnpm lint` enforces the rules marked **(lint)**; the rest are checked in review. When a rule and readability disagree, raise it in the PR instead of working around the rule.

**A rule that a tool can check is a tool, not a sentence.** When a rule here can be a lint rule, a type or a test, it becomes one (our own rules live in `packages/tooling/eslint-local-rules.mjs` and run in Oxlint as a JS plugin); text is for what no tool can check.

## Architecture

- **Packages and their direction (lint).** `protocol` imports no other package. `agy` imports only `protocol`. `core` imports `protocol` and `agy`. `api` and `mcp` import `core` and `protocol`, never `agy` and never each other. `apps/server` imports `api`, `mcp`, `core` and `protocol` and only mounts routes (`local/package-boundaries`; `scripts/architecture.test.mjs` checks the `package.json` files).
- **Other packages through their root (lint).** `@antigravity-connector/core`, never `@antigravity-connector/core/Services/QueueService.ts`. A package imports its own files through its own name and the real file name (`@antigravity-connector/api/Utils/PathUtil.ts`), never `../` or `./` (`no-restricted-imports`). There is no build step between packages: `exports` points at `src`.
- **Only `agy` spawns a process (lint).** `child_process` is imported only under `packages/agy/src` (`local/no-child-process-outside-agy`). Everything else asks `core`, which asks `agy`.
- **Nobody touches the credentials folder (lint).** No string or template in any file contains the CLI's credentials folder name, tests included (`local/no-gemini-path`). The app never reads, copies, logs or forwards the login token.
- **Layers inside a package.** From the bottom: `Errors` (import nothing), `Protocols` (types), `Schemas` (Zod), `Utils`, `Services` and `Adapters`, `Setup`; `Tools` (MCP) and `Routes` (HTTP) are the top layers of `mcp` and `api`. A layer imports only the ones below it (review). Import cycles fail `pnpm quality` (dpdm).
- **Names say the folder (lint: `local/file-suffix`).** Files are `PascalCase` and end with the folder's name, singular, before `.ts` and before `.test`: `QueueService`, `AgyRunAdapter`, `WebSearchTool`, `ChatCompletionRoute`, `EnvUtil`. Subfolders take the suffix of the top folder. The map of folder to suffix is `SUFFIX_BY_FOLDER` in `packages/tooling/eslint-local-rules.mjs`: `Adapters`, `Errors`, `Protocols`, `Routes`, `Schemas`, `Services`, `Setup`, `Tools`, `Utils`. A new folder under `src/` needs its entry in the map before its first file. Exempt: `index.ts`, `*.d.ts`, and folders not in the map (`Testing`).
- **One class per file, named after it (lint).** `max-classes-per-file`, `local/class-matches-file`.
- **Classes, not loose functions.** Utils are classes with static methods only. Services are classes whose dependencies come in through the constructor. Runtime constants belong to the class that owns them as `static readonly` members.
- **A `<Name>Protocol.ts` file holds types only (lint: `local/protocol-types-only`).** `type`, `enum` or `interface`, no value. Use `type` by default; `interface` is only the contract of a class, named `<Name>Port` (`local/interface-for-contracts`). A type used by more than one file lives in a Protocols file (review).
- **Schemas live in `<Name>Schema.ts` (lint: `local/schema-file`).** Other files import a schema; they never call a Zod builder. Declare the type, then check the schema against it: `export const FooSchema: z.ZodType<Foo> = z.object({ … })` (lint: `local/no-inferred-type`: no `z.infer`, no `typeof SOME_CONSTANT`, no `as const` made to build a type).
- **Errors live in `Errors/` (lint: `local/error-location`).** One class per file, named after what went wrong and ending in `Error` (e.g. `DailyLimitError`).

## Naming

- **English everywhere.** Identifiers, environment variables, tool names, parameters, comments, docs and messages.
- **Casing (lint).** Variables, functions and parameters are `camelCase`. Types, interfaces and classes are `PascalCase`. Module-level and `static readonly` constants are `UPPER_CASE`. Environment variables keep their `UPPER_CASE` spelling. Tool names a client sees and the keys of external formats keep their wire spelling (`snake_case`).
- **Descriptive names (lint).** No single-letter identifiers, including loop indexes and callbacks. A name says what the value is in this domain (`GLOSSARY.md`), never `data`, `item`, `value` or `obj` when something more specific exists.
- **Function names (lint: `local/verb-function-name`).** A function or method starts with a verb in base form as a whole camelCase word. The allowed verbs are `ALLOWED_VERBS` in the local rules file; add a real verb there when none fits. Predicates (`is`, `has`, `can`, `should`) are exempt.
- **Booleans (lint).** Start with `is`, `has`, `should`, `can`, `must`, `was` or `did`, affirmative: `isConnected`, never `isNotReady`.
- **Maps and records (lint: `local/map-name`).** Every `Record` or `Map` is named `keyToValue`: `kindToProfile`, `RUN_KIND_TO_LIMIT`.
- **Units.** A number with a unit carries it in the name: `timeoutMs`, `maxTokens`. Epoch milliseconds end in `AtMs`; ISO strings end in `At`.

## Functions

- **A function is an arrow function (lint: `local/arrow-function`, `prefer-arrow-callback`).** `const readPage = async (url: string): Promise<Page> => { … }`. A `const` is defined before it is used, so a function sits above the code that calls it. A generator, a function that reads its own `this` or `arguments`, an overloaded function and a function with an assertion signature stay `function`.

## TypeScript

- **No `any` (lint).** Data from outside the program (the environment, `agy` output, request bodies, tool arguments) is `unknown` and is parsed with a Zod schema before use.
- **No vague types for known shapes.** Declare the shape or a union of string literals instead of `object`, `Record<string, unknown>` or `string`.
- **Known values are typed, not `string` (lint: `local/known-keys`, `local/no-bare-string-field`).** A property named `type`, `kind`, `state`, `status`, `role`, `mode` or `phase` is typed with a declared union (`RunKind`). A value from outside that the code does not know is parsed to `"unknown"` in its schema and ignored, never thrown at.
- **Exhaustive unions (lint).** A `switch` over a union handles every member; prefer a `Record<Union, …>` map.
- **`strict` and `noUncheckedIndexedAccess`** are on.

## Logic

- **Braces always, no magic numbers (lint).** Every number other than `0`, `1` and `-1` is a named constant with its unit. Tests are exempt.
- **Maps over comparing with fixed values (lint: `local/literal-dispatch`).** When code decides what to do by comparing a value with fixed strings, the decision is a `Record<Key, Handler>`, so a new member of the union is a compile error until it has its handler. Allowed: a guard that leaves early.
- **Small functions (lint).** Cognitive complexity ≤ 15, nesting ≤ 3, parameters ≤ 5. Extract a named method instead of raising a limit.
- **Name a call before passing it on (lint).** A call with three or more arguments, or that receives another call, is stored in a named variable first.
- **No nested ternaries, no `console` (lint).** Logging goes through `LogUtil`, which writes metadata only.
- **Floating promises (lint).** Every promise is awaited or returned.
- **No duplicated logic (review).** Search before adding a helper; reuse or extract to a Util.

## Boundaries and security

- **Environment variables (lint: `local/no-process-env`).** `process.env` is read only in `EnvUtil`, validated with Zod at startup.
- **Validate at the edge.** Input is parsed where it enters: the environment, request bodies, tool inputs, and every line `agy` prints. Code past the edge trusts its types.
- **Rules that cannot fail live in code (review, plus a test each).** Authentication, the loopback bind, the queue, the daily limits and redaction are enforced in code, never only in a prompt or a doc.
- **A run is contained (review, plus a test).** Every `agy` run uses a fresh empty temporary directory, a timeout that kills the process, and removes the directory afterwards.
- **Redact on the way out.** Every string that can reach a log passes through the redaction util. Logs carry metadata only: door, route or tool, model, duration, token counts. Never message content, queries, prompts, image bytes or the `API_KEY`. Any new output path gets a test with a fake secret.

## Before committing

Commit once per task, not per file. Before the commit, `pnpm check:changed` must pass. A `pnpm quality` finding means delete the dead code or extract the shared part, not add an ignore. While iterating, run only the relevant file (`pnpm exec vitest run <file>`).

## Dependencies

- **pnpm only.** Commit `pnpm-lock.yaml`; never `package-lock.json`. The lockfile changes only with a `package.json`.
- **A new runtime dependency needs a reason** in the PR description.

## Backward compatibility

Code that exists only so old stored data keeps working carries a `// @legacy: <what and why>` comment, so it can be found and removed. Anything else changes without a compatibility path.

## Formatting and comments

- **Formatting (lint).** `@stylistic`: 2-space indent, double quotes, semicolons, trailing commas in multi-line literals, lines up to 120 characters. `pnpm lint:fix` applies it. Never add spaces to align values.
- **No comments by default (lint).** A comment stays only when the code guards a rule it does not show. It starts with `Why:` and names the rule (`local/comment-marker`). A comment sits on the line it explains, never above a whole function, class or type, never as a file header, never in a Protocols file (`local/comment-placement`).
