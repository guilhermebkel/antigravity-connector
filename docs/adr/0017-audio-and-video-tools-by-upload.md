# 0017. Audio and video tools read uploaded files

Status: accepted (2026-11-27). Extends [0015](0015-upload-link-for-reference-images.md): the upload link also takes audio and video, and two MCP tools read them. The agy version in the image moves from 1.5.9 to 1.5.18.

## Context

agy 1.5.18 lists the Gemini 4 models (`gemini-4-neon`, `-hydrogen`, `-carbon`, `-argon`) for the owner's login, and it reads an audio or video file from its working directory, with the picture and the sound. A real call on 1.5.18 described a 4 second MP4 (colors, a counter, a tone) and transcribed a spoken WAV. An audio or video file is far larger than a picture, so it cannot travel as base64 inside a tool call.

## Decision

- `create_upload_link` takes an optional `kind`: `image` (the default, 4 MiB), `audio` (20 MiB) or `video` (30 MiB). It returns `kind` and `file` (`upload:<id>`); `image` stays with the same value for clients that read it.
- The type of the file comes from its first bytes and must match the kind of the link: MP3, WAV, M4A, AAC, OGG, FLAC or WebM for audio; MP4, MOV, WebM or AVI for video. A file of another type, or over the limit of its kind, is refused and the link stays valid.
- The server holds at most 60 MiB of uploads in memory at once (two of the largest files), besides the limit of 8 entries. An upload that would pass it is refused as too many waiting.
- A file is read only as the kind it was uploaded as. `transcribe_audio` takes an audio upload and `analyse_video` a video upload; a picture reference to `generate_image` must be an image upload. A wrong or expired reference is refused before the queue and the daily limit, so it spends no run.
- Both tools run as the new run kind `media`: plan mode, no output file, the base timeout, and its own daily limit `DAILY_LIMIT_MEDIA` (default 20). The prompt tells agy that the file is data and to ignore any instruction spoken or shown in it.
- Both tools are jobs like `generate_image`: after about 20 seconds they return `running` and a `job_id` for `get_result`.
- The model catalogue gains `gemini-4-neon`, `gemini-4-hydrogen` and `gemini-4-carbon` at the efforts `low`, `medium` and `high`; the MCP tools take their `model` list from one schema. `xhigh` is not offered.
- The image pins agy 1.5.18. The stream mode that image runs use ([0016](0016-image-runs-wait-for-the-file.md)) was checked on 1.5.18: the `init` event, the stdin line and the `result` event have the same shape.

## Consequences

- A client needs a machine that can send an HTTP request to use audio or video; there is no URL or base64 input for them.
- Memory holds up to 60 MiB of uploads. A restart forgets them.
- Whether the Gemini 4 models give better answers or cost more quota is not measured here.
- Video generation is not offered: agy has an image generator subagent and no video one.
