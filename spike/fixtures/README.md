# Spike fixtures

Output of `agy` 1.5.9 captured in the spike environment (issue #2, S10). Every `conversation_id` is replaced with the invented value `00000000-0000-4000-8000-000000000000`. The secret grep from issue #2 prints nothing over `spike/`.

| File | Source | Status |
| --- | --- | --- |
| `chat-envelope.json` | `agy -p "ping" --output-format json` | captured |
| `chat-model-low-envelope.json` | `agy -p ... --model gemini-3.8-flash-low --output-format json` | captured |
| `search-envelope.json` | `agy -p ... --output-format json`, web search | captured |
| `chat-stream.ndjson` | `agy -p ... --mode plan --output-format stream-json`, chat with no tool use | captured |
| `search-stream.ndjson` | `agy -p ... --output-format stream-json`, web search (6 `search_web` tool steps) | captured |
| `image-envelope.json` | image generation | not captured |
| `error-envelope.json` | error envelope | not captured (the no-session error is in `docs/spike-results.md`, S2) |
| `no-session.txt` | raw text printed with no session | not captured as a raw file (see S2) |
