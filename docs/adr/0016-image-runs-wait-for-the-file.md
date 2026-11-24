# 0016. Image runs wait for the file, not for agy's answer

Status: accepted (2026-11-23). Changes how `agy` is called for `generate_image` in [0003](0003-shell-out-to-agy-instead-of-using-the-token.md): an image run keeps the process open and watches the working directory.

## Context

`generate_image` sometimes ended with `image_not_produced` even though agy reported `SUCCESS`. The answer said the image was still being made ("I will notify you when it is ready"), and `output.png` never appeared (issues #38, #53 and #56).

The run used `agy -p <prompt> --output-format json`. In that mode agy exits as soon as its turn ends, and the `image-generator` subagent is killed with it. A run that finishes before the subagent writes the file comes back with no file. A stronger instruction in the prompt did not fix it: the model can still end its turn early, and a prompt is not a rule that cannot fail.

Watching the folder after the process has exited cannot help either: folders of failed runs never got the file later.

## Decision

- An image run starts agy with `--input-format stream-json --output-format stream-json` and `-p=`. The session stays open until stdin is closed, so the subagent keeps running after the first turn ends.
- The prompt is not in the arguments. It is written to stdin as one JSON line (`{"event":"user","message":{"content":...}}`) only after agy has sent its `init` event. Before `init`, nothing is written, so a login prompt cannot read the prompt text as an authorization code.
- The server decides that the run is done by the file, not by the answer: `output.png` exists, has the PNG signature and end marker, and kept the same size across two polls (every 500 ms).
- When the file is complete, the server waits up to 5 seconds for agy's `result` event to read the usage, then closes stdin and stops the process group. If the `result` comes first, the file is read at once.
- If the `result` event arrives with `SUCCESS` and the file is not there, the server keeps waiting `AGY_OUTPUT_WAIT_MS` (default 30 seconds), then returns agy's answer as the reason (`image_not_produced`), as before.
- The overall limit for an image call is 60 percent of `AGY_TIMEOUT_MS` (180 seconds with the default). Successful calls took 50 to 100 seconds in production. A `result` with an error status, a process that exits without a `result` and a client abort fail as they did.
- Only runs with `shouldWaitForOutputFiles` use this path. `generate_image` sets it; `browse` does not, because its screenshot is optional and waiting for it would delay every run that has none.

## Consequences

- A run no longer depends on what agy writes in its answer, and a file that appears after the first turn is found.
- A run whose file never appears takes up to `AGY_OUTPUT_WAIT_MS` longer to fail than before.
- A run in which agy never sends a `result` (for example a subagent that keeps retrying a model request) now lasts until the image limit, where `agy -p` used to exit early. In the first days in production, two calls ran the whole 300 seconds and ended with `agy_timeout`. The timeout error now carries the last step agy reported and how long it was silent (for example `subagent ACTIVE, silent for 200 s`), in the log and in the MCP error, and never agy's text. The step is read from the raw line, because the stream schema drops step types it does not know (`subagent`, `system_message`).
- Measured with agy 1.5.9: three live runs in this mode all waited for the subagent and wrote the file before the `result` event. The failure itself was not reproduced in this mode, so whether the open session rescues a late file is not proven by those runs; it should be measured in production (#56).
- The stdin format of agy (`event: "user"`) is read from its behavior, not from a documented contract. A new agy version can change it; the pinned version in the Dockerfile limits that risk.
