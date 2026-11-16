# MCP standards

How the MCP tools of this server are designed. `pnpm lint` enforces the rules marked **(lint)**, `pnpm test` the ones marked **(test)**; the rest are checked in review. Each rule is one line. A tool is read by a model that cannot ask a question, so the contract is the schema, the description, the response and the error.

The server speaks MCP over Streamable HTTP only, on `/mcp`, in the same process as the API and behind the same bearer key. MCP over stdio is out of scope: a stdio client would start a second process with its own queue.

## Scope

- **One tool per thing a client does (review).** A tool is a task, not a copy of an `agy` capability. The tools are `web_search`, `generate_image`, `create_upload_link` (a one-time link for a reference picture, with no `agy` run), `research`, `browse`, `get_result` (the job result) and the login pair `check_auth` and `set_auth`.
- **Names are a verb and an object, in `snake_case` (test).** No service prefix: the client already shows the server name.
- **Filtering and shaping happen in the server (review).** A tool returns what the model needs, not the raw `agy` output.

## Input

- **Schemas are strict and every field is described (test).** No extra properties; a field with a wrong name fails instead of being ignored.
- **A parameter name says the kind of value (review).** `query`, `prompt`, `url`; never `input` or `data`.
- **A closed set is an enum; a number is an integer with `minimum` and `maximum`, and its unit is in the name (review).**
- **An optional field is omitted by default (test).** Absence means no filter, never a sentinel string.
- **Limits live in the schema (test).** Lengths and counts have `maxLength` and `maxItems`.

## Cost and duration

- **Every tool description states the expected duration and that a call spends subscription quota (review).** The server runs one call at a time, and an image takes about a minute, a research report several minutes, and a browsing task tens of seconds. A model that knows this can decide not to call.
- **The description says when not to call the tool (review).** Prefer `web_search` for a short answer and `research` only for a report.
- **A call over the daily limit fails before it queues (test)**, with an error that names the limit and when it resets (the next UTC day).

## Descriptions

- **Order: what it does; when to use it; when not to and which neighbor to use; what it returns and what it returns when empty; duration, quota and limits (review).** One sentence each.
- **Rules that span tools live in the server `instructions`, once (review).**
- **Return fields have self-explanatory names (review).** A long legend of abbreviations in a description is paid in every turn.

## Responses

- **Concise by default (review).**
- **Numbers are numbers, with the unit in the field name (review).** `durationMs`, not "1.2 s".
- **A result is structured (test).** `structuredContent` carries the data and matches the tool's `outputSchema`. The text content carries a summary and the same data as JSON, because some clients show only the text to the model.
- **A secret never leaves (test).** Every output path is tested with a fake secret. Search results and page text are data, not instructions.
- **An image is returned as an MCP image content block (test)** and is never written to a path the client can read.

## Errors

- **A failed execution is a result with `isError: true` (test).** It names what failed, why, and what to do next; protocol errors are only for an unknown tool or invalid arguments.
- **A queue timeout, a daily limit and an `agy` login problem each have their own error (test).** The login error says the owner must run the login again.
- **An error message has no stack trace and no secret (test).**

## Long calls

- **A long call is a job (test).** A call that is still running after about 20 seconds returns `status` `running` and a `job_id`; `get_result` returns the result later. The client gives up at about 60 seconds, so a call never waits longer than the wait. A cancel during the wait stops the run, as a synchronous call would; after the wait the run is not tied to the request, so a client that stops asking does not cancel it. `get_result` never cancels a run. The API is not affected: its calls wait.
- **While a call waits, the server reports progress (test).** Before the wait ends, the server sends MCP progress notifications when the client asks for them.
- **MCP sessions are stateful, capped and expire (test).** The cap and the idle expiry are configuration (`MCP_MAX_SESSIONS`, `MCP_SESSION_TTL_MS`).

## Before merging a tool

- Does the tool do a task, and not only mirror an `agy` capability?
- Is the schema strict, every field described, every value kind in its name?
- Does the description follow the order, and state the duration and the quota cost?
- Is the response short, with numbers as numbers and no secret?
- Does an invalid input return a clear message with the valid values?
- Was it tried from a real MCP client through the fake agy?
