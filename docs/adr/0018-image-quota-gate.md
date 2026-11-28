# 0018. The image quota gate

Status: accepted (2026-11-28). Extends [0016](0016-image-runs-wait-for-the-file.md): an image call whose answer is a quota answer starts a cooldown, and new image calls wait for it.

## Context

The image model has its own quota on the subscription, separate from the text models, and `/usage` does not show it. When it is used up, agy answers with `RESOURCE_EXHAUSTED (429)` and a reset time, for example `quota will reset after 4h28m46s`. Before this decision the server passed the text on as `image_not_produced` and the next call went to agy again, so a client that retried spent agy time and quota on calls that could not work. Measured on 2026-11-27 and 2026-11-28: the reset came in a few hours, and in the window after a reset a call sometimes worked and then the quota was gone again.

## Decision

- A finished image run with no `output.png` whose answer is classified as `quota` ([#64](https://github.com/guilhermebkel/antigravity-connector/issues/64)) starts a cooldown. The reset time is read from the answer. Without a usable time the cooldown is 60 minutes; a time over 24 hours is capped at 24 hours.
- While the cooldown runs, a new image call is refused before any agy run and before the daily image limit: it does not start a run and does not use `DAILY_LIMIT_IMAGE`.
- The refusal is `image_quota_exhausted`: HTTP 429 with type `rate_limit_error` on `/v1`, and a tool error on MCP, both with the reset time (`It resets at <ISO time>, in about N minutes`).
- One cooldown is shared by the MCP tools and `/v1`, because both use one image service.
- The cooldown is held in memory. A restart forgets it, and the first image call after a restart runs agy once more.
- The gate applies to image runs only. Text runs, `browse`, `transcribe_audio` and `analyse_video` do not wait for it.

## Consequences

- A client gets the reset time at once and does not spend quota on calls that would fail.
- A quota that resets earlier than the answer says is not used before the time agy gave.
- Two calls that start together can both run before the first learns of the quota; the second then fails once more.
- The fallback and the cap are guesses until the answer format is seen in production; the answer text is never logged, only the kind (#64).
