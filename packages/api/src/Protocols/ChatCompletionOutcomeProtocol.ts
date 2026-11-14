import type { ChatCompletionResponse } from "@antigravity-connector/protocol";

export type ChatCompletionOutcome = {
  body: ChatCompletionResponse;
  ignoredParams: readonly string[];
};
