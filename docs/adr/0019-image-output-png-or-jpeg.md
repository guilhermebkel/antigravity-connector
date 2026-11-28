# 0019. The picture output is PNG or JPEG

Status: accepted (2026-11-28). Changes the output part of [0014](0014-reference-images-by-https-url.md) and [0016](0016-image-runs-wait-for-the-file.md): an image run returns a PNG or a JPEG, not only a PNG.

## Context

An edit with a reference image ended with no `output.png`: agy made the picture and saved it as `.jpg` in its own artifact folder, outside the run's working directory, then promised to convert it. The server found no file and failed. The same edit worked with a prompt that named `output.png` in the working directory, and the owner asked for JPEG to be accepted in the output too.

## Decision

- The image run prompt asks for `output.png` (PNG) in the working directory, and says a JPEG saved there as `output.jpg` is also fine. It forbids other folders and converting or copying a file.
- When the run has no `output.png`, the server takes the one picture in the run's own working directory that is not an attachment. Two candidates without `output.png` give none. Nothing outside that directory is read: agy's artifact folder belongs to the CLI and is never read (lint `local/no-gemini-path`).
- The file is checked by its bytes: a PNG signature or a JPEG signature (`FF D8 FF`). The mime type comes from the bytes, not from the name.
- A JPEG is complete only with its end marker (`FF D9`), as a PNG is only complete with its end chunk.
- `generate_image` returns the `mimeType` it found (`image/png` or `image/jpeg`); the MCP schema allows both. The `/v1` `b64_json` field carries no type, as OpenAI's does, so clients that decode the bytes work for both.

## Consequences

- A client that assumed PNG for `mimeType` must accept `image/jpeg` too.
- A picture saved under another name in a different folder still fails: the server does not look there.
- No new dependency: no conversion to PNG.
