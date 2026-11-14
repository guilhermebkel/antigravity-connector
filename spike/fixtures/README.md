# Spike fixtures

Raw, unedited output of `agy` captured inside the spike container (issue #2, S10). **Not captured yet:** every capture needs the owner's Google AI Pro login.

Before a file is committed:

- replace every `conversation_id`, account id and personal text with invented values;
- run the secret grep from issue #2 over `spike/` and confirm it prints nothing.

| File (planned) | Source | Status |
| --- | --- | --- |
| `chat-envelope.json` | `agy -p ... --output-format json`, chat | not captured |
| `search-envelope.json` | `agy -p ... --output-format json`, search | not captured |
| `image-envelope.json` | `agy -p ... --output-format json`, image | not captured |
| `error-envelope.json` | `agy -p ... --output-format json`, an error | not captured |
| `chat-stream.ndjson` | `agy -p ... --output-format stream-json`, chat | not captured |
| `search-stream.ndjson` | `agy -p ... --output-format stream-json`, search (must contain tool `step_type` events) | not captured |
| `no-session.txt` | the output `agy` prints when there is no login | not captured |
