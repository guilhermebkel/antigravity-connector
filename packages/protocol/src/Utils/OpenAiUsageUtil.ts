import type { AgyUsage } from "@antigravity-connector/protocol/Protocols/AgyEnvelopeProtocol.ts";
import type { OpenAiUsage } from "@antigravity-connector/protocol/Protocols/OpenAiChatProtocol.ts";

export class OpenAiUsageUtil {
  static map(usage: AgyUsage): OpenAiUsage {
    return {
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens + usage.thinking_tokens,
      total_tokens: usage.total_tokens,
      completion_tokens_details: { reasoning_tokens: usage.thinking_tokens },
      prompt_tokens_details: { cached_tokens: usage.cache_read_tokens },
    };
  }
}
