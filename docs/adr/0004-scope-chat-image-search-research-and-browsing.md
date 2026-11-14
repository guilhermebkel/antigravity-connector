# 0004. Scope: chat, image, search, research and browsing

Status: accepted (2026-11-14)

## Context

`agy` 1.5.3 was tested on 2026-11-14 on a Google AI Pro plan. The project exposes what it can do and nothing else.

## Decision

In scope: chat (with and without streaming), web search, image generation, research (a longer report through search) and browsing (only through the `/browser` slash command). Out of scope: video and Google Flow, Deep Research from the Gemini app, `run_workflow` and `/swarm`, MCP over stdio, any web page, multi-user use, exposing the server to a network and tool calling passed through from the OpenAI client.

## Evidence

The test table in the project brief (issue #1) records each capability with its time and token cost. In short: an image took 54 s and 18,487 tokens; a research report 3 min 43 s and 95,104 tokens; browsing 39 s and 29,465 tokens through `/browser` and failed when requested in free text; video and Flow have no tool, subagent, plugin or MCP; `read_url_content` is not usable.

## Consequences

- Browsing and images are the only runs that may write, and only inside their temporary directory; browsing always uses a throwaway browser profile.
- A capability that appears later in `agy` is a new decision, not an implicit one.
